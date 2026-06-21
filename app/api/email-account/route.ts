import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEmailAccountRaw, upsertEmailAccount, initSchema } from '@/lib/db';
import { encryptSecret } from '@/lib/email';

export const runtime = 'nodejs';

async function uid() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const id = (session.user as any).id ? Number((session.user as any).id) : null;
  return id;
}

export async function GET() {
  const userId = await uid();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initSchema();
  const a: any = await getEmailAccountRaw(userId);
  if (!a) return NextResponse.json({ configured: false });
  return NextResponse.json({
    configured: true,
    account_name: a.account_name, email_address: a.email_address,
    imap_host: a.imap_host, imap_port: a.imap_port, imap_username: a.imap_username,
    imap_folder: a.imap_folder, imap_secure: a.imap_secure !== 0,
    smtp_host: a.smtp_host, smtp_port: a.smtp_port, smtp_username: a.smtp_username,
    reply_from: a.reply_from, last_synced_at: a.last_synced_at,
    imap_password_set: !!a.imap_password_enc, smtp_password_set: !!a.smtp_password_enc,
  });
}

export async function PUT(req: NextRequest) {
  const userId = await uid();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const email = String(body.email_address || '').trim();
  const imapHost = String(body.imap_host || '').trim();
  const imapUser = String(body.imap_username || '').trim();
  if (!email) return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
  if (!imapHost || !imapUser) return NextResponse.json({ error: 'IMAP host and username are required' }, { status: 400 });

  await initSchema();
  const existing: any = await getEmailAccountRaw(userId);

  const data: Record<string, any> = {
    account_name: String(body.account_name || '').trim() || null,
    email_address: email,
    imap_host: imapHost,
    imap_port: Number(body.imap_port) || 993,
    imap_username: imapUser,
    imap_folder: String(body.imap_folder || '').trim() || 'INBOX',
    imap_secure: body.imap_secure === false ? 0 : 1,
    smtp_host: String(body.smtp_host || '').trim() || null,
    smtp_port: Number(body.smtp_port) || 587,
    smtp_username: String(body.smtp_username || '').trim() || null,
    reply_from: String(body.reply_from || '').trim() || null,
  };
  if (body.imap_password) data.imap_password_enc = encryptSecret(String(body.imap_password));
  if (body.smtp_password) data.smtp_password_enc = encryptSecret(String(body.smtp_password));

  if (!data.imap_password_enc && !existing?.imap_password_enc) {
    return NextResponse.json({ error: 'IMAP password (Gmail App Password) is required' }, { status: 400 });
  }

  await upsertEmailAccount(userId, data);
  return NextResponse.json({ ok: true });
}
