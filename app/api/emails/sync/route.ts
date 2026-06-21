import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getEmailAccountRaw, emailMessageExists, upsertThreadForMessage, insertEmailMessage, findLeadByEmail,
  markEmailSynced, getAutopilotThreads, getEmailThreadFull, setThreadFlags, initSchema,
} from '@/lib/db';
import { accountToConfig, fetchRecentMessages, sendMail } from '@/lib/email';
import { aiEmail } from '@/lib/emailAi';

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
  try {
    const msgs = await fetchRecentMessages(cfg, 40);
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
    await markEmailSynced(userId);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Sync failed', imported }, { status: 200 });
  }

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
        const reply = await aiEmail({
          action: 'reply', tone: 'Friendly', senderName,
          thread: { subject: t.subject, counterpart: t.counterpart_name || t.counterpart_email,
            leadContext: full.lead_name ? `${full.lead_name} (${full.lead_stage})` : '',
            messages: msgs.map((m: any) => ({ direction: m.direction, body: m.body_text || '' })) },
        });
        if (!reply) continue;
        if (t.auto_mode === 'send' && cfg.smtp_host && (cfg.smtp_password || cfg.imap_password)) {
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
