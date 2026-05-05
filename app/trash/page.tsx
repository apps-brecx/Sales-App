'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import StageBadge from '@/components/StageBadge';
import { useSession } from 'next-auth/react';
import { timeAgo, cn } from '@/lib/utils';
import Link from 'next/link';

export default function TrashPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = () => { setLoading(true); fetch('/api/trash').then(r=>r.json()).then(d=>{ setLeads(Array.isArray(d)?d:[]); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const allSel = leads.length > 0 && leads.every(l=>selected.has(l.id));
  const toggleAll = () => allSel ? setSelected(new Set()) : setSelected(new Set(leads.map(l=>l.id)));
  const toggleOne = (id: number) => { const s=new Set(selected); s.has(id)?s.delete(id):s.add(id); setSelected(s); };

  async function action(act: 'restore'|'permanent_delete', ids?: number[]) {
    const target = ids || Array.from(selected);
    if (!target.length) return;
    if (act === 'permanent_delete' && !confirm(`Permanently delete ${target.length} lead(s)? Cannot be undone.`)) return;
    setBusy(true);
    await fetch('/api/trash', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action: act, ids: target }) });
    setSelected(new Set()); setBusy(false); load();
  }

  return (
    <AppShell>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/leads" className="text-sm text-slate-400 hover:text-brand-600 flex items-center gap-1 mb-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              Back to Leads
            </Link>
            <h1 className="page-title flex items-center gap-2">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              Trash
            </h1>
            <p className="page-sub">{leads.length} deleted lead{leads.length!==1?'s':''}</p>
          </div>
          {leads.length > 0 && (
            <button onClick={()=>action('permanent_delete', leads.map(l=>l.id))} disabled={busy} className="btn-danger">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              Empty Trash
            </button>
          )}
        </div>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="mb-4 flex items-center gap-3 px-5 py-3 bg-slate-800 text-white rounded-2xl animate-fade-in">
            <span className="text-sm font-semibold">{selected.size} selected</span>
            <div className="flex-1"/>
            <button onClick={()=>action('restore')} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 rounded-xl text-sm font-medium hover:bg-emerald-600 disabled:opacity-50">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Restore
            </button>
            <button onClick={()=>action('permanent_delete')} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 rounded-xl text-sm font-medium hover:bg-rose-600 disabled:opacity-50">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              Delete Forever
            </button>
            <button onClick={()=>setSelected(new Set())} className="px-3 py-1.5 bg-white/10 rounded-xl text-sm hover:bg-white/20">✕</button>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">{[...Array(3)].map((_,i)=><div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse"/>)}</div>
        ) : leads.length === 0 ? (
          <div className="card p-16 text-center">
            <div className="text-5xl mb-3">🗑️</div>
            <div className="font-semibold text-slate-600 mb-1">Trash is empty</div>
            <div className="text-sm text-slate-400">Deleted leads appear here</div>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 w-10 text-center"><input type="checkbox" checked={allSel} onChange={toggleAll} className="rounded border-slate-300 cursor-pointer"/></th>
                  {['Company','Stage','Contact','Deleted','Actions'].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {leads.map(lead => (
                  <tr key={lead.id} className={cn('transition-colors', selected.has(lead.id) ? 'bg-rose-50' : 'hover:bg-slate-50')}>
                    <td className="px-4 py-3.5 text-center"><input type="checkbox" checked={selected.has(lead.id)} onChange={()=>toggleOne(lead.id)} className="rounded border-slate-300 cursor-pointer"/></td>
                    <td className="px-4 py-3.5"><span className="font-semibold text-slate-500 line-through">{lead.company_name}</span></td>
                    <td className="px-4 py-3.5"><StageBadge stage={lead.stage}/></td>
                    <td className="px-4 py-3.5 text-slate-500">{lead.contact_name||'—'}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">{lead.deleted_at ? timeAgo(lead.deleted_at) : '—'}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-2">
                        <button onClick={()=>action('restore',[lead.id])} disabled={busy} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50">Restore</button>
                        <button onClick={()=>action('permanent_delete',[lead.id])} disabled={busy} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 disabled:opacity-50">Delete Forever</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
