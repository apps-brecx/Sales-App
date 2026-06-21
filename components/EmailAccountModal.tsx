'use client';
import { useState } from 'react';

const GMAIL = { imap_host: 'imap.gmail.com', imap_port: 993, smtp_host: 'smtp.gmail.com', smtp_port: 587 };

type Acct = any;

export default function EmailAccountModal({ initial, onClose, onSaved }: { initial: Acct | null; onClose: () => void; onSaved: () => void }) {
  const cfg = initial && initial.configured ? initial : null;
  const [f, setF] = useState({
    account_name: cfg?.account_name || '',
    email_address: cfg?.email_address || '',
    imap_host: cfg?.imap_host || GMAIL.imap_host,
    imap_port: String(cfg?.imap_port || GMAIL.imap_port),
    imap_username: cfg?.imap_username || '',
    imap_password: '',
    imap_folder: cfg?.imap_folder || 'INBOX',
    imap_secure: cfg ? !!cfg.imap_secure : true,
    smtp_host: cfg?.smtp_host || GMAIL.smtp_host,
    smtp_port: String(cfg?.smtp_port || GMAIL.smtp_port),
    smtp_username: cfg?.smtp_username || '',
    smtp_password: '',
    reply_from: cfg?.reply_from || '',
  });
  const [testing, setTesting] = useState(false);
  const [testRes, setTestRes] = useState<{ imap: { ok: boolean; error?: string }; smtp: { ok: boolean; error?: string } } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: any) => setF(s => ({ ...s, [k]: v }));
  const imapPwSet = !!cfg?.imap_password_set;
  const smtpPwSet = !!cfg?.smtp_password_set;

  async function test() {
    setTesting(true); setTestRes(null); setError('');
    try {
      const res = await fetch('/api/email-account/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, imap_port: Number(f.imap_port), smtp_port: Number(f.smtp_port) }) });
      setTestRes(await res.json());
    } catch { setError('Could not run the test.'); }
    setTesting(false);
  }

  async function save() {
    setError('');
    if (!f.email_address.trim()) { setError('Email address is required.'); return; }
    if (!imapPwSet && !f.imap_password) { setError('Enter your Gmail App Password.'); return; }
    setSaving(true);
    const res = await fetch('/api/email-account', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, imap_port: Number(f.imap_port), smtp_port: Number(f.smtp_port) }) });
    setSaving(false);
    if (res.ok) onSaved();
    else { const d = await res.json().catch(() => ({})); setError(d.error || 'Could not save.'); }
  }

  const inp = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20';
  const lab = 'block text-xs font-medium text-slate-500 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl my-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">{cfg ? 'Edit email account' : 'Add email account'}</h2>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className={lab}>Account name</label>
            <input className={inp} value={f.account_name} onChange={e => set('account_name', e.target.value)} placeholder="contact@syruvia" />
          </div>
          <div>
            <label className={lab}>Email address</label>
            <input className={inp} value={f.email_address} onChange={e => set('email_address', e.target.value)} placeholder="contact@syruvia.com" />
          </div>

          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 pt-2">IMAP (receive)</div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lab}>IMAP host</label><input className={inp} value={f.imap_host} onChange={e => set('imap_host', e.target.value)} /></div>
            <div><label className={lab}>IMAP port</label><input className={inp} value={f.imap_port} onChange={e => set('imap_port', e.target.value)} /></div>
          </div>
          <div><label className={lab}>IMAP username</label><input className={inp} value={f.imap_username} onChange={e => set('imap_username', e.target.value)} placeholder="contact@syruvia.com" /></div>
          <div>
            <label className={lab}>IMAP password / App password</label>
            <input type="password" className={inp} value={f.imap_password} onChange={e => set('imap_password', e.target.value)} placeholder={imapPwSet ? '(unchanged — leave blank to keep)' : 'Gmail App Password'} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lab}>IMAP folder</label><input className={inp} value={f.imap_folder} onChange={e => set('imap_folder', e.target.value)} /></div>
            <div>
              <label className={lab}>Secure (SSL/TLS)</label>
              <select className={inp} value={f.imap_secure ? 'yes' : 'no'} onChange={e => set('imap_secure', e.target.value === 'yes')}>
                <option value="yes">Yes (recommended)</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 pt-2">SMTP (send replies) — optional, leave blank to reuse IMAP creds</div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lab}>SMTP host</label><input className={inp} value={f.smtp_host} onChange={e => set('smtp_host', e.target.value)} /></div>
            <div><label className={lab}>SMTP port</label><input className={inp} value={f.smtp_port} onChange={e => set('smtp_port', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lab}>SMTP username</label><input className={inp} value={f.smtp_username} onChange={e => set('smtp_username', e.target.value)} /></div>
            <div><label className={lab}>SMTP password</label><input type="password" className={inp} value={f.smtp_password} onChange={e => set('smtp_password', e.target.value)} placeholder={smtpPwSet ? '(unchanged)' : '(same as IMAP)'} /></div>
          </div>
          <div><label className={lab}>Reply from address</label><input className={inp} value={f.reply_from} onChange={e => set('reply_from', e.target.value)} placeholder={f.email_address || 'contact@syruvia.com'} /></div>

          {testRes && (
            <div className="rounded-xl border border-slate-200 p-3 space-y-1.5 text-sm">
              <ConnLine label="IMAP (receive)" res={testRes.imap} />
              <ConnLine label="SMTP (send)" res={testRes.smtp} />
            </div>
          )}
          {error && <div className="text-sm text-rose-600">{error}</div>}
        </div>

        <div className="flex items-center px-6 py-4 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
          <button onClick={test} className="text-sm font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50" disabled={testing}>
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={save} className="btn-primary" disabled={saving}>{saving ? 'Saving…' : cfg ? 'Update account' : 'Add account'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnLine({ label, res }: { label: string; res: { ok: boolean; error?: string } }) {
  return (
    <div className="flex items-start gap-2">
      {res.ok
        ? <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
        : <svg className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>}
      <div>
        <span className={`font-medium ${res.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{label}: {res.ok ? 'Connected' : 'Failed'}</span>
        {!res.ok && res.error && <div className="text-xs text-slate-500">{res.error}</div>}
      </div>
    </div>
  );
}
