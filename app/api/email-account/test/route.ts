import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEmailAccountRaw, initSchema } from '@/lib/db';
import { decryptSecret, testConnection, MailConfig } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });

  const body = await req.json();
  await initSchema();
  const existing: any = await getEmailAccountRaw(userId);

  const imapPass = body.imap_password ? String(body.imap_password) : decryptSecret(existing?.imap_password_enc);
  const smtpPass = body.smtp_password ? String(body.smtp_password) : decryptSecret(existing?.smtp_password_enc);

  const cfg: MailConfig = {
    email_address: String(body.email_address || existing?.email_address || ''),
    imap_host: String(body.imap_host || existing?.imap_host || ''),
    imap_port: Number(body.imap_port) || existing?.imap_port || 993,
    imap_username: String(body.imap_username || existing?.imap_username || ''),
    imap_password: imapPass,
    imap_folder: String(body.imap_folder || existing?.imap_folder || 'INBOX'),
    imap_secure: body.imap_secure === false ? false : body.imap_secure === true ? true : existing?.imap_secure !== 0,
    smtp_host: String(body.smtp_host || existing?.smtp_host || ''),
    smtp_port: Number(body.smtp_port) || existing?.smtp_port || 587,
    smtp_username: String(body.smtp_username || existing?.smtp_username || ''),
    smtp_password: smtpPass,
    reply_from: String(body.reply_from || existing?.reply_from || ''),
  };

  try {
    const result = await testConnection(cfg);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ imap: { ok: false, error: e?.message || 'Test failed' }, smtp: { ok: false, error: '' } }, { status: 200 });
  }
}
