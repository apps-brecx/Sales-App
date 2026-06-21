import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getEmailAccountRaw, getThreadByKey, upsertThreadForMessage, insertEmailMessage, findLeadByEmail,
  getEmailThreadFull, setThreadFlags, createOutbox, initSchema,
} from '@/lib/db';
import { accountToConfig, sendMail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });

  const { to, subject, body, thread_id, include_signature, schedule_at } = await req.json();
  await initSchema();

  const acct: any = await getEmailAccountRaw(userId);
  if (!acct) return NextResponse.json({ error: 'Connect an email account first' }, { status: 400 });
  const cfg = accountToConfig(acct);
  const myAddr = (cfg.email_address || cfg.imap_username).toLowerCase();

  let recipient = String(to || '').trim().toLowerCase();
  let subj = String(subject || '').trim();
  let inReplyTo: string | undefined;

  if (thread_id) {
    const full: any = await getEmailThreadFull(userId, Number(thread_id));
    if (!full) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    recipient = full.counterpart_email;
    subj = subj || (full.subject?.startsWith('Re:') ? full.subject : `Re: ${full.subject || ''}`.trim());
    const lastIn = [...(full.messages || [])].reverse().find((m: any) => m.direction === 'in');
    inReplyTo = lastIn?.message_id || undefined;
  }
  if (!recipient) return NextResponse.json({ error: 'A recipient is required' }, { status: 400 });
  if (!body?.trim()) return NextResponse.json({ error: 'Message body is required' }, { status: 400 });
  if (!cfg.smtp_host && !cfg.imap_host) return NextResponse.json({ error: 'No SMTP host configured' }, { status: 400 });

  const useSig = include_signature !== false && acct.include_signature !== 0 && acct.signature;
  const finalBody = useSig ? `${body}\n\n${acct.signature}` : body;

  // Scheduled send — queue it; the next sync delivers anything due.
  if (schedule_at) {
    const when = new Date(schedule_at);
    if (!isNaN(when.getTime()) && when.getTime() > Date.now() + 30000) {
      await createOutbox({ user_id: userId, thread_id: thread_id ? Number(thread_id) : null, to_addr: recipient, subject: subj || '(no subject)', body: finalBody, send_at: when.toISOString() });
      return NextResponse.json({ ok: true, scheduled: true });
    }
  }

  try {
    await sendMail(cfg, { to: recipient, subject: subj || '(no subject)', text: finalBody, inReplyTo });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Send failed' }, { status: 200 });
  }

  // Record the sent message in the thread.
  let tid = thread_id ? Number(thread_id) : 0;
  if (!tid) {
    const existing: any = await getThreadByKey(userId, recipient);
    const lead = await findLeadByEmail(recipient);
    tid = existing ? existing.id : await upsertThreadForMessage(userId, recipient, { email: recipient, subject: subj, lastAt: new Date(), snippet: body.replace(/\s+/g, ' ').slice(0, 140), inbound: false, lead_id: lead ? (lead as any).id : null });
  }
  await insertEmailMessage({ thread_id: tid, user_id: userId, direction: 'out', from_addr: myAddr, to_addr: recipient, subject: subj, body_text: finalBody, sent_at: new Date() });
  await setThreadFlags(userId, tid, { last_message_at: new Date().toISOString(), last_snippet: body.replace(/\s+/g, ' ').slice(0, 140), draft_text: null });

  return NextResponse.json({ ok: true, thread_id: tid });
}
