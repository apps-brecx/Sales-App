import crypto from 'crypto';

// Encrypt IMAP/SMTP passwords at rest with AES-256-GCM, keyed off NEXTAUTH_SECRET.
const SECRET = process.env.NEXTAUTH_SECRET || 'sales-app-dev-secret-change-me';
const KEY = crypto.createHash('sha256').update(SECRET).digest();

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}
export function decryptSecret(data: string | null | undefined): string {
  if (!data) return '';
  try {
    const buf = Buffer.from(data, 'base64');
    const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch { return ''; }
}

export type MailConfig = {
  email_address: string;
  imap_host: string; imap_port: number; imap_username: string; imap_password: string; imap_folder: string; imap_secure: boolean;
  smtp_host: string; smtp_port: number; smtp_username: string; smtp_password: string;
  reply_from: string;
};

type CheckResult = { ok: boolean; error?: string };

export async function testConnection(cfg: MailConfig): Promise<{ imap: CheckResult; smtp: CheckResult }> {
  const out = { imap: { ok: false } as CheckResult, smtp: { ok: false } as CheckResult };

  // IMAP
  if (!cfg.imap_host || !cfg.imap_username || !cfg.imap_password) {
    out.imap = { ok: false, error: 'IMAP host, username and password are required' };
  } else {
    try {
      const { ImapFlow } = await import('imapflow');
      const client = new ImapFlow({
        host: cfg.imap_host, port: cfg.imap_port || 993, secure: cfg.imap_secure !== false,
        auth: { user: cfg.imap_username, pass: cfg.imap_password }, logger: false,
        emitLogs: false,
      });
      await client.connect();
      const lock = await client.getMailboxLock(cfg.imap_folder || 'INBOX');
      lock.release();
      await client.logout();
      out.imap = { ok: true };
    } catch (e: any) {
      out.imap = { ok: false, error: cleanErr(e?.message || 'IMAP connection failed') };
    }
  }

  // SMTP (optional — reuse IMAP creds if not provided)
  const smtpHost = cfg.smtp_host || '';
  if (!smtpHost) {
    out.smtp = { ok: false, error: 'No SMTP host set (replies will be unavailable)' };
  } else {
    try {
      const nodemailer = (await import('nodemailer')).default;
      const port = cfg.smtp_port || 587;
      const transport = nodemailer.createTransport({
        host: smtpHost, port, secure: port === 465,
        auth: { user: cfg.smtp_username || cfg.imap_username, pass: cfg.smtp_password || cfg.imap_password },
      });
      await transport.verify();
      out.smtp = { ok: true };
    } catch (e: any) {
      out.smtp = { ok: false, error: cleanErr(e?.message || 'SMTP connection failed') };
    }
  }

  return out;
}

export async function sendMail(cfg: MailConfig, msg: { to: string; subject: string; text?: string; html?: string; inReplyTo?: string }) {
  const nodemailer = (await import('nodemailer')).default;
  const port = cfg.smtp_port || 587;
  const transport = nodemailer.createTransport({
    host: cfg.smtp_host || cfg.imap_host.replace(/^imap\./, 'smtp.'),
    port, secure: port === 465,
    auth: { user: cfg.smtp_username || cfg.imap_username, pass: cfg.smtp_password || cfg.imap_password },
  });
  const from = cfg.reply_from || cfg.email_address;
  const info = await transport.sendMail({ from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html, inReplyTo: msg.inReplyTo });
  return { messageId: info.messageId };
}

function cleanErr(m: string): string {
  // Surface the useful bit of common Gmail/IMAP errors.
  if (/Invalid credentials|AUTHENTICATIONFAILED|Username and Password not accepted/i.test(m)) {
    return 'Login failed — check the username and that you used a Gmail App Password (not your normal password).';
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(m)) return 'Host not found — check the IMAP/SMTP host.';
  if (/ETIMEDOUT|ECONNREFUSED|timed out/i.test(m)) return 'Could not reach the server — check host/port and that the network allows it.';
  return m.length > 160 ? m.slice(0, 157) + '…' : m;
}
