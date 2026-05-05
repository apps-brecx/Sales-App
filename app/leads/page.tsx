'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import StageBadge from '@/components/StageBadge';
import { Lead, LeadStage } from '@/types';
import { ALL_STAGES, STAGE_CONFIG, formatDate, timeAgo, cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function LeadsPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<LeadStage | 'all'>('all');
  const [view, setView] = useState<'table' | 'cards' | 'kanban'>('table');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkStage, setBulkStage] = useState('');
  const [showBulkStage, setShowBulkStage] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const load = () => fetch('/api/leads').then(r=>r.json()).then(d=>{ setLeads(Array.isArray(d)?d:[]); setLoading(false); });
  useEffect(() => { load(); }, []);

  const filtered = leads.filter(l => {
    const s = !search || l.company_name.toLowerCase().includes(search.toLowerCase()) || (l.contact_name||'').toLowerCase().includes(search.toLowerCase());
    const st = stageFilter === 'all' || l.stage === stageFilter;
    return s && st;
  });

  const allSel = filtered.length > 0 && filtered.every(l => selected.has(l.id));
  const toggleAll = () => allSel ? setSelected(new Set()) : setSelected(new Set(filtered.map(l=>l.id)));
  const toggleOne = (id: number) => { const s = new Set(selected); s.has(id)?s.delete(id):s.add(id); setSelected(s); };

  async function bulkDelete() {
    if (!confirm(`Move ${selected.size} lead(s) to trash?`)) return;
    setBulkLoading(true);
    await fetch('/api/leads/bulk', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'delete', ids: Array.from(selected) }) });
    setSelected(new Set()); setBulkLoading(false); load();
  }

  async function bulkChangeStage() {
    if (!bulkStage) return;
    setBulkLoading(true);
    await fetch('/api/leads/bulk', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'update', ids: Array.from(selected), data: { stage: bulkStage } }) });
    setSelected(new Set()); setBulkStage(''); setShowBulkStage(false); setBulkLoading(false); load();
  }

  const canEdit = role !== 'viewer';
  const canDelete = ['admin','manager'].includes(role);

  return (
    <AppShell>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title">Leads</h1>
            <p className="page-sub">{leads.length} leads · {filtered.length} shown</p>
          </div>
          <div className="flex gap-2">
            <Link href="/trash" className="btn-secondary text-xs">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              Trash
            </Link>
            <Link href="/leads/new" className="btn-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              New Lead
            </Link>
          </div>
        </div>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="mb-4 flex items-center gap-3 px-5 py-3 bg-brand-600 text-white rounded-2xl shadow-md animate-fade-in">
            <span className="text-sm font-semibold">{selected.size} selected</span>
            <div className="flex-1"/>
            {showBulkStage ? (
              <div className="flex items-center gap-2">
                <select className="px-3 py-1.5 rounded-xl text-sm text-slate-800 bg-white border-0" value={bulkStage} onChange={e=>setBulkStage(e.target.value)}>
                  <option value="">Choose stage…</option>
                  {ALL_STAGES.map(s=><option key={s} value={s}>{STAGE_CONFIG[s].label}</option>)}
                </select>
                <button onClick={bulkChangeStage} disabled={!bulkStage||bulkLoading} className="px-3 py-1.5 bg-white text-brand-700 rounded-xl text-sm font-semibold hover:bg-brand-50 disabled:opacity-50">Apply</button>
                <button onClick={()=>setShowBulkStage(false)} className="px-3 py-1.5 bg-white/20 rounded-xl text-sm hover:bg-white/30">Cancel</button>
              </div>
            ) : (
              <>
                {canEdit && <button onClick={()=>setShowBulkStage(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 rounded-xl text-sm font-medium hover:bg-white/30">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/></svg>
                  Change Stage
                </button>}
                {canDelete && <button onClick={bulkDelete} disabled={bulkLoading} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 rounded-xl text-sm font-medium hover:bg-rose-600 disabled:opacity-50">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  Trash
                </button>}
                <button onClick={()=>setSelected(new Set())} className="px-3 py-1.5 bg-white/10 rounded-xl text-sm hover:bg-white/20">✕ Clear</button>
              </>
            )}
          </div>
        )}

        {/* Filters + View toggle */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input className="input pl-9 w-56" placeholder="Search leads…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={()=>setStageFilter('all')} className={cn('px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all', stageFilter==='all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}>All</button>
            {ALL_STAGES.map(s => {
              const c = STAGE_CONFIG[s];
              return <button key={s} onClick={()=>setStageFilter(s)} className={cn('px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all', stageFilter===s ? `${c.bg} ${c.color} ${c.border}` : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}>{c.label}</button>;
            })}
          </div>
          <div className="ml-auto flex gap-1 bg-slate-100 p-1 rounded-xl">
            {(['table','cards','kanban'] as const).map(v => (
              <button key={v} onClick={()=>setView(v)} className={cn('px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all', view===v ? 'bg-white shadow-xs text-slate-800' : 'text-slate-500 hover:text-slate-700')}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">{[...Array(5)].map((_,i)=><div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse"/>)}</div>
        ) : filtered.length === 0 ? (
          <div className="card p-16 text-center">
            <div className="text-5xl mb-3">🔍</div>
            <div className="font-semibold text-slate-600 mb-1">No leads found</div>
            <div className="text-sm text-slate-400">Adjust filters or add a new lead</div>
          </div>
        ) : view === 'table' ? (
          <TableView leads={filtered} selected={selected} onToggleAll={toggleAll} onToggleOne={toggleOne} allSelected={allSel} canEdit={canEdit}/>
        ) : view === 'cards' ? (
          <CardsView leads={filtered}/>
        ) : (
          <KanbanView leads={filtered}/>
        )}
      </div>
    </AppShell>
  );
}

function TableView({ leads, selected, onToggleAll, onToggleOne, allSelected, canEdit }: any) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            <th className="px-4 py-3 w-10 text-center">
              {canEdit && <input type="checkbox" checked={allSelected} onChange={onToggleAll} className="rounded border-slate-300 text-brand-600 cursor-pointer"/>}
            </th>
            {['Company','Contact','Stage','Progress','Updates','Last Activity','Added'].map(h=>(
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {leads.map((lead: Lead) => {
            const stg = STAGE_CONFIG[lead.stage];
            const pct = ['new','contacted','follow_up','proposal','closed_won','closed_lost'].indexOf(lead.stage);
            const isSel = selected.has(lead.id);
            return (
              <tr key={lead.id} className={cn('transition-colors', isSel ? 'bg-brand-50' : 'hover:bg-slate-50')}>
                <td className="px-4 py-3.5 text-center">
                  {canEdit && <input type="checkbox" checked={isSel} onChange={()=>onToggleOne(lead.id)} className="rounded border-slate-300 text-brand-600 cursor-pointer"/>}
                </td>
                <td className="px-4 py-3.5">
                  <Link href={`/leads/${lead.id}`} className="font-semibold text-slate-800 hover:text-brand-600 transition-colors">{lead.company_name}</Link>
                  {lead.source==='email' && <span className="ml-2 text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">email</span>}
                </td>
                <td className="px-4 py-3.5 text-slate-600">{lead.contact_name||<span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3.5"><StageBadge stage={lead.stage}/></td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', stg.dot)} style={{width:`${Math.max(5, (pct/5)*100)}%`}}/>
                    </div>
                    <span className="text-xs text-slate-400">{Math.round((pct/5)*100)}%</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-slate-600">{(lead as any).update_count||0}</td>
                <td className="px-4 py-3.5 text-xs text-slate-400">{(lead as any).last_update ? timeAgo((lead as any).last_update) : '—'}</td>
                <td className="px-4 py-3.5 text-xs text-slate-400">{formatDate(lead.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CardsView({ leads }: { leads: Lead[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {leads.map(lead => {
        const cfg = STAGE_CONFIG[lead.stage];
        return (
          <Link key={lead.id} href={`/leads/${lead.id}`}>
            <div className="card-hover p-5 cursor-pointer group">
              <div className="flex items-start justify-between mb-3">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold', cfg.bg, cfg.color)}>
                  {lead.company_name[0].toUpperCase()}
                </div>
                <StageBadge stage={lead.stage}/>
              </div>
              <div className="font-semibold text-slate-800 group-hover:text-brand-600 transition-colors mb-1">{lead.company_name}</div>
              {lead.contact_name && <div className="text-sm text-slate-500 mb-3">{lead.contact_name}</div>}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100">
                <span>{(lead as any).update_count||0} updates</span>
                <span>{(lead as any).last_update ? timeAgo((lead as any).last_update) : 'No activity'}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function KanbanView({ leads }: { leads: Lead[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {ALL_STAGES.map(stage => {
        const cfg = STAGE_CONFIG[stage];
        const col = leads.filter(l=>l.stage===stage);
        return (
          <div key={stage} className="shrink-0 w-72">
            <div className={cn('flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3 border', cfg.bg, cfg.border)}>
              <span className={cn('w-2 h-2 rounded-full', cfg.dot)}/>
              <span className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</span>
              <span className={cn('ml-auto text-xs font-bold', cfg.color)}>{col.length}</span>
            </div>
            <div className="space-y-2">
              {col.map(lead => (
                <Link key={lead.id} href={`/leads/${lead.id}`}>
                  <div className="card-hover p-4 cursor-pointer group">
                    <div className="font-semibold text-sm text-slate-800 group-hover:text-brand-600 mb-1">{lead.company_name}</div>
                    {lead.contact_name && <div className="text-xs text-slate-400 mb-2">{lead.contact_name}</div>}
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{(lead as any).update_count||0} updates</span>
                      <span>{(lead as any).last_update ? timeAgo((lead as any).last_update) : '—'}</span>
                    </div>
                  </div>
                </Link>
              ))}
              {col.length === 0 && <div className="text-center py-6 text-xs text-slate-300">Empty</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
