'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { REFERRAL_STATUS, REFERRAL_STATUSES, formatDateTime, cn } from '@/lib/utils';

export default function ReferralDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const canEdit = role !== 'viewer';
  const [r, setR] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [nextStatus, setNextStatus] = useState('');
  const [adding, setAdding] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<any>({});
  const [emailOpen, setEmailOpen] = useState(false);

  const load = () => fetch(`/api/referrals/${params.id}`).then(res => { if (!res.ok) throw new Error(); return res.json(); }).then(d => { setR(d); setForm(d); setLoading(false); }).catch(() => router.push('/referrals'));
  useEffect(() => { load(); }, [params.id]);

  async function addUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setAdding(true);
    await fetch(`/api/referrals/${params.id}/updates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, status_from: r.status, status_to: nextStatus || null }) });
    setContent(''); setNextStatus(''); setAdding(false); load();
  }
  async function changeStatus(s: string) {
    await fetch(`/api/referrals/${params.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: s }) });
    load();
  }
  async function saveEdit() {
    await fetch(`/api/referrals/${params.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, distributor: form.distributor || null, contact_name: form.contact_name || null, contact_email: form.contact_email || null, contact_phone: form.contact_phone || null, notes: form.notes || null }) });
    setEditMode(false); load();
  }
  async function del() {
    if (!confirm(`Delete "${r.name}"?`)) return;
    await fetch(`/api/referrals/${params.id}`, { method: 'DELETE' });
    router.push('/referrals');
  }

  if (loading) return <AppShell><div className="p-8"><div className="animate-pulse h-40 bg-slate-100 rounded-2xl" /></div></AppShell>;
  if (!r) return null;
  const st = REFERRAL_STATUS[r.status] || REFERRAL_STATUS.new;

  return (
    <AppShell>
      <div className="p-8 max-w-4xl mx-auto">
        <Link href="/referrals" className="text-sm text-slate-400 hover:text-brand-600 inline-flex items-center gap-1 mb-4"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>All Referrals</Link>

        <div className="card p-6 mb-5">
          {!editMode ? (
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <h1 className="text-2xl font-bold text-slate-900">{r.name}</h1>
                  {r.distributor && <span className="badge bg-violet-50 text-violet-700 border-violet-200">🏢 {r.distributor}</span>}
                  <span className={cn('badge', st.color, st.bg, st.border)}><span className={cn('w-1.5 h-1.5 rounded-full', st.dot)} />{st.label}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                  {r.contact_name && <Info label="Contact" value={r.contact_name} />}
                  {r.contact_email && <Info label="Email" value={r.contact_email} href={`mailto:${r.contact_email}`} />}
                  {r.contact_phone && <Info label="Phone" value={r.contact_phone} href={`tel:${r.contact_phone}`} />}
                  {r.assigned_name && <Info label="Rep" value={r.assigned_name} />}
                </div>
                {r.notes && <p className="text-sm text-slate-500 mt-3 whitespace-pre-wrap">{r.notes}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                {r.contact_email && <button onClick={() => setEmailOpen(true)} className="btn-secondary"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>Email</button>}
                {canEdit && <button onClick={() => setEditMode(true)} className="btn-secondary">Edit</button>}
                {['admin', 'manager', 'salesman'].includes(role) && <button onClick={del} className="btn-danger">Delete</button>}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="font-semibold text-slate-800">Edit store</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="label">Store name</label><input className="input" value={form.name || ''} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} /></div>
                <div><label className="label">Distributor</label><input className="input" value={form.distributor || ''} onChange={e => setForm((f: any) => ({ ...f, distributor: e.target.value }))} /></div>
                <div><label className="label">Contact name</label><input className="input" value={form.contact_name || ''} onChange={e => setForm((f: any) => ({ ...f, contact_name: e.target.value }))} /></div>
                <div><label className="label">Email</label><input className="input" value={form.contact_email || ''} onChange={e => setForm((f: any) => ({ ...f, contact_email: e.target.value }))} /></div>
                <div><label className="label">Phone</label><input className="input" value={form.contact_phone || ''} onChange={e => setForm((f: any) => ({ ...f, contact_phone: e.target.value }))} /></div>
                <div className="col-span-2"><label className="label">Notes</label><textarea className="input resize-none" rows={2} value={form.notes || ''} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} /></div>
              </div>
              <div className="flex gap-2"><button onClick={saveEdit} className="btn-primary">Save</button><button onClick={() => { setEditMode(false); setForm(r); }} className="btn-secondary">Cancel</button></div>
            </div>
          )}
        </div>

        {/* Status pipeline */}
        {canEdit && (
          <div className="card p-5 mb-5">
            <h3 className="font-semibold text-slate-800 mb-3">Status</h3>
            <div className="flex flex-wrap gap-2">
              {REFERRAL_STATUSES.map(s => { const c = REFERRAL_STATUS[s]; return <button key={s} onClick={() => changeStatus(s)} className={cn('px-3 py-1.5 rounded-full text-xs font-medium border', r.status === s ? `${c.bg} ${c.color} ${c.border}` : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300')}>{c.label}</button>; })}
            </div>
          </div>
        )}

        {/* Add update */}
        {canEdit && (
          <div className="card p-5 mb-5">
            <h3 className="font-semibold text-slate-800 mb-3">Add update</h3>
            <form onSubmit={addUpdate} className="space-y-3">
              <textarea className="input resize-none" rows={3} placeholder="Visited the store, spoke with the manager…" value={content} onChange={e => setContent(e.target.value)} required />
              <div className="flex items-center gap-3">
                <select className="input flex-1" value={nextStatus} onChange={e => setNextStatus(e.target.value)}><option value="">Keep status — {st.label}</option>{REFERRAL_STATUSES.map(s => <option key={s} value={s}>{REFERRAL_STATUS[s].label}</option>)}</select>
                <button type="submit" className="btn-primary" disabled={adding || !content.trim()}>{adding ? 'Saving…' : 'Add update'}</button>
              </div>
            </form>
          </div>
        )}

        {/* Timeline */}
        <h3 className="font-semibold text-slate-800 mb-3">Activity <span className="text-slate-400 font-normal text-sm">({r.updates?.length || 0})</span></h3>
        {!r.updates?.length ? <div className="card p-10 text-center text-sm text-slate-400">No activity yet.</div> : (
          <div className="space-y-3">
            {r.updates.map((u: any) => (
              <div key={u.id} className="card p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {u.user_name && <span className="text-xs font-semibold text-slate-700">{u.user_name}</span>}
                    {u.status_from && u.status_to && u.status_from !== u.status_to && <span className="text-xs text-slate-400">{REFERRAL_STATUS[u.status_from]?.label} → <span className="text-slate-700 font-medium">{REFERRAL_STATUS[u.status_to]?.label}</span></span>}
                  </div>
                  <span className="text-xs text-slate-400">{formatDateTime(u.created_at)}</span>
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{u.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {emailOpen && <SendEmailModal to={r.contact_email} name={r.name} onClose={() => setEmailOpen(false)} />}
    </AppShell>
  );
}

function Info({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      {href ? <a href={href} className="text-sm font-medium text-brand-600 hover:underline truncate block">{value}</a> : <div className="text-sm font-medium text-slate-700 truncate">{value}</div>}
    </div>
  );
}

function SendEmailModal({ to, name, onClose }: { to: string; name: string; onClose: () => void }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function send() {
    if (!body.trim()) return;
    setBusy(true); setMsg('');
    const res = await fetch('/api/emails/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, subject, body }) });
    const d = await res.json(); setBusy(false);
    if (d.ok) { setMsg('Sent ✓'); setTimeout(onClose, 700); } else setMsg(d.error || 'Send failed — connect your email in the Email tab.');
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h2 className="font-bold text-slate-800">Email {name}</h2><button onClick={onClose} className="text-slate-300 hover:text-slate-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button></div>
        <div className="space-y-3">
          <div className="text-xs text-slate-400">To {to}</div>
          <input className="input" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
          <textarea className="input min-h-[140px]" placeholder="Write your message…" value={body} onChange={e => setBody(e.target.value)} />
          {msg && <div className="text-sm text-slate-600">{msg}</div>}
          <div className="flex items-center gap-2">
            <button onClick={send} className="btn-primary" disabled={busy || !body.trim()}>{busy ? 'Sending…' : 'Send'}</button>
            <Link href={`/emails?q=${encodeURIComponent(to)}`} className="btn-secondary">Open in Email</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
