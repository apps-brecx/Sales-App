import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getEmailAccountRaw, emailMessageExists, upsertThreadForMessage, insertEmailMessage, findLeadByEmail,
  markEmailSynced, getAutopilotThreads, getEmailThreadFull, setThreadFlags, getDueOutbox, deleteOutbox, initSchema,
} from '@/lib/db';
import { accountToConfig, fetchRecentMessages, sendMail } from '@/lib/email';
import { aiEmail, looksReadyToBuy } from '@/lib/emailAi';

function inBusinessHours(): boolean {
  const h = new Date().getHours();
  const day = new Date().getDay();
  return day >= 1 && day <= 5 && h >= 9 && h < 18;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  const senderName = (session.user as any)?.name || '';
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });
  await initSchema();

  const acct: any = await getEmailAccountRaw(userId);
  if (!acct) return NextResponse.json({ error: 'No email account connected' }, { status: 400 });
  const cfg = accountToConfig(acct);
  const myAddr = (cfg.email_address || cfg.imap_username).toLowerCase();

  let imported = 0;
  const ingest = async (msgs: any[]) => {
    msgs.sort((a, b) => a.date.getTime() - b.date.getTime());
    for (const m of msgs) {
      if (await emailMessageExists(userId, m.messageId)) continue;
      const isOut = m.from.address === myAddr;
      const counterpart = (isOut ? m.to[0] : m.from.address) || '';
      if (!counterpart) continue;
      const lead = await findLeadByEmail(counterpart);
      const threadId = await upsertThreadForMessage(userId, counterpart, {
        name: isOut ? '' : m.from.name, email: counterpart, subject: m.subject,
        lastAt: m.date, snippet: m.text.replace(/\s+/g, ' ').slice(0, 140), inbound: !isOut, lead_id: lead ? (lead as any).id : null,
      });
      await insertEmailMessage({
        thread_id: threadId, user_id: userId, direction: isOut ? 'out' : 'in',
        from_addr: m.from.address, from_name: m.from.name, to_addr: m.to[0] || myAddr,
        subject: m.subject, body_text: m.text, message_id: m.messageId, in_reply_to: m.inReplyTo, imap_uid: m.uid, sent_at: m.date,
      });
      imported++;
    }
  };
  try {
    await ingest(await fetchRecentMessages(cfg, 40));
    await markEmailSynced(userId);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Sync failed', imported }, { status: 200 });
  }
  // Also pull recently-sent mail so the Sent tab reflects everything.
  for (const folder of ['[Gmail]/Sent Mail', 'Sent']) {
    try { await ingest(await fetchRecentMessages(cfg, 25, folder)); break; } catch { /* try next folder name */ }
  }

  // Deliver any scheduled sends that are now due.
  try {
    const due = await getDueOutbox(userId);
    for (const o of due as any[]) {
      try {
        await sendMail(cfg, { to: o.to_addr, subject: o.subject || '(no subject)', text: o.body });
        let tid = o.thread_id || 0;
        if (!tid) {
          const lead = await findLeadByEmail(o.to_addr);
          tid = await upsertThreadForMessage(userId, o.to_addr.toLowerCase(), { email: o.to_addr.toLowerCase(), subject: o.subject, lastAt: new Date(), snippet: (o.body || '').replace(/\s+/g, ' ').slice(0, 140), inbound: false, lead_id: lead ? (lead as any).id : null });
        }
        await insertEmailMessage({ thread_id: tid, user_id: userId, direction: 'out', from_addr: myAddr, to_addr: o.to_addr, subject: o.subject, body_text: o.body, sent_at: new Date() });
        await setThreadFlags(userId, tid, { last_message_at: new Date().toISOString(), last_snippet: (o.body || '').replace(/\s+/g, ' ').slice(0, 140) });
      } finally {
        await deleteOutbox(o.id);
      }
    }
  } catch { /* outbox best-effort */ }

  // Autopilot pass — only when the master switch is on. Best-effort, guarded.
  let autopilot = 0;
  if (acct.autopilot_master) {
    try {
      const threads = await getAutopilotThreads(userId);
      for (const t of (threads as any[]).slice(0, 6)) {
        const full: any = await getEmailThreadFull(userId, t.id);
        const msgs = full?.messages || [];
        const last = msgs[msgs.length - 1];
        if (!last || last.direction !== 'in') continue; // only when they replied last
        // Hand back to the human when the lead looks ready to buy.
        if (acct.autopilot_handback && looksReadyToBuy(last.body_text || '')) {
          const reply = await aiEmail({ action: 'reply', tone: acct.autopilot_voice || 'Friendly', senderName,
            thread: { subject: t.subject, counterpart: t.counterpart_name || t.counterpart_email, leadContext: full.lead_name ? `${full.lead_name} (${full.lead_stage})` : '', messages: msgs.map((m: any) => ({ direction: m.direction, body: m.body_text || '' })) } });
          await setThreadFlags(userId, t.id, { autopilot: 0, draft_text: reply || '', unread: 1 });
          autopilot++;
          continue;
        }
        const reply = await aiEmail({
          action: 'reply', tone: acct.autopilot_voice || 'Friendly', senderName,
          thread: { subject: t.subject, counterpart: t.counterpart_name || t.counterpart_email,
            leadContext: full.lead_name ? `${full.lead_name} (${full.lead_stage})` : '',
            messages: msgs.map((m: any) => ({ direction: m.direction, body: m.body_text || '' })) },
        });
        if (!reply) continue;
        const hoursOk = acct.autopilot_hours === 'any' || inBusinessHours();
        if (t.auto_mode === 'send' && hoursOk && cfg.smtp_host && (cfg.smtp_password || cfg.imap_password)) {
          const body = acct.signature ? `${reply}\n\n${acct.signature}` : reply;
          await sendMail(cfg, { to: t.counterpart_email, subject: t.subject?.startsWith('Re:') ? t.subject : `Re: ${t.subject || ''}`.trim(), text: body, inReplyTo: last.message_id });
          await insertEmailMessage({ thread_id: t.id, user_id: userId, direction: 'out', from_addr: myAddr, to_addr: t.counterpart_email, subject: t.subject, body_text: body, sent_at: new Date() });
          await setThreadFlags(userId, t.id, { last_message_at: new Date().toISOString(), last_snippet: reply.replace(/\s+/g, ' ').slice(0, 140), draft_text: null });
        } else {
          await setThreadFlags(userId, t.id, { draft_text: reply });
        }
        autopilot++;
      }
    } catch { /* autopilot is best-effort */ }
  }

  return NextResponse.json({ imported, autopilot });
}
