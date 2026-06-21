'use client';
import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { REFERRAL_STATUS, REFERRAL_STATUSES, timeAgo, cn } from '@/lib/utils';

type Referral = { id: number; name: string; distributor: string | null; contact_name: string | null; contact_email: string | null; status: string; assigned_name: string | null; update_count: number; last_update: string | null; updated_at: string };

export default function ReferralsPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [distributors, setDistributors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dist, setDist] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  function load() {
    fetch('/api/referrals').then(r => r.json()).then(d => { setReferrals(Array.isArray(d.referrals) ? d.referrals : []); setDistributors(Array.isArray(d.distributors) ? d.distributors : []); setLoading(false); }).catch(() => setLoading(false));
  }
  useEffect(load, []);

  const shown = useMemo(() => referrals.filter(r => {
    const d = dist === 'all' || (r.distributor || '') === dist;
    const s = statusFilter === 'all' || r.status === statusFilter;
    const q = !search || r.name.toLowerCase().includes(search.toLowerCase()) || (r.contact_name || '').toLowerCase().includes(search.toLowerCase());
    return d && s && q;
  }), [referrals, dist, statusFilter, search]);

  return (
    <AppShell>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h1 className="page-title">Referrals</h1>
            <p className="page-sub">Stores you're getting to request Syruvia from their distributor — so the distributor stocks it.</p>
          </div>
          {role !== 'viewer' && <button onClick={() => setAdding(true)} className="btn-primary shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Add store
          </button>}
        </div>

        {/* Distributor filter */}
        <div className="flex flex-wrap items-center gap-2 my-5">
          <button onClick={() => setDist('all')} className={chip(dist === 'all')}>All distributors</button>
          {distributors.map(d => <button key={d} onClick={() => setDist(d)} className={chip(dist === d)}>{d}</button>)}
          <div className="ml-auto flex items-center gap-2">
            <input className="input w-48 text-sm" placeholder="Search stores…" value={search} onChange={e => setSearch(e.target.value)} />
            <select className="input w-auto text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              {REFERRAL_STATUSES.map(s => <option key={s} value={s}>{REFERRAL_STATUS[s].label}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}</div>
        ) : shown.length === 0 ? (
          <div className="card p-12 text-center text-slate-400">No stores yet. Add one to start building demand under a distributor.</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 bg-slate-50">{['Store', 'Distributor', 'Status', 'Contact', 'Updates', 'Last activity'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-50">
                {shown.map(r => {
                  const st = REFERRAL_STATUS[r.status] || REFERRAL_STATUS.new;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3"><Link href={`/referrals/${r.id}`} className="font-semibold text-slate-800 hover:text-brand-600">{r.name}</Link></td>
                      <td className="px-4 py-3">{r.distributor ? <span className="badge bg-violet-50 text-violet-700 border-violet-200">{r.distributor}</span> : <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3"><span className={cn('badge', st.color, st.bg, st.border)}><span className={cn('w-1.5 h-1.5 rounded-full', st.dot)} />{st.label}</span></td>
                      <td className="px-4 py-3 text-slate-600">{r.contact_name || <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-slate-600">{r.update_count || 0}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{r.last_update ? timeAgo(r.last_update) : timeAgo(r.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adding && <AddStoreModal distributors={distributors} onClose={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />}
    </AppShell>
  );
}

function chip(active: boolean) { return `px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`; }

function AddStoreModal({ distributors, onClose, onDone }: { distributors: string[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', distributor: '', contact_name: '', contact_email: '', contact_phone: '', status: 'new', notes: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setF(s => ({ ...s, [k]: v }));
  async function save() {
    if (!f.name.trim()) return;
    setSaving(true);
    const res = await fetch('/api/referrals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    setSaving(false);
    if (res.ok) onDone();
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-slate-800">Add store</h2><button onClick={onClose} className="text-slate-300 hover:text-slate-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button></div>
        <div className="space-y-3">
          <div><label className="label">Store name *</label><input className="input" value={f.name} onChange={e => set('name', e.target.value)} placeholder="Main St Market" /></div>
          <div>
            <label className="label">Distributor</label>
            <input className="input" list="distList" value={f.distributor} onChange={e => set('distributor', e.target.value)} placeholder="e.g. Sysco" />
            <datalist id="distList">{distributors.map(d => <option key={d} value={d} />)}</datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Contact name</label><input className="input" value={f.contact_name} onChange={e => set('contact_name', e.target.value)} /></div>
            <div><label className="label">Status</label><select className="input" value={f.status} onChange={e => set('status', e.target.value)}>{REFERRAL_STATUSES.map(s => <option key={s} value={s}>{REFERRAL_STATUS[s].label}</option>)}</select></div>
            <div><label className="label">Email</label><input className="input" value={f.contact_email} onChange={e => set('contact_email', e.target.value)} /></div>
            <div><label className="label">Phone</label><input className="input" value={f.contact_phone} onChange={e => set('contact_phone', e.target.value)} /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="input resize-none" rows={2} value={f.notes} onChange={e => set('notes', e.target.value)} /></div>
          <div className="flex gap-2 pt-1"><button onClick={save} className="btn-primary flex-1 justify-center" disabled={saving || !f.name.trim()}>{saving ? 'Adding…' : 'Add store'}</button><button onClick={onClose} className="btn-secondary">Cancel</button></div>
        </div>
      </div>
    </div>
  );
}
