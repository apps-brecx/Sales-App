'use client';
import { useEffect, useMemo, useState } from 'react';
import { formatDate } from '@/lib/utils';

type Audit = { id: number; title: string | null; audit_date: string; period_start: string | null; scope: string; is_closed: number; target_count: number; done_count: number; created_by_name: string | null };
type LeadLite = { id: number; company_name: string; assigned_name: string | null; stage: string };

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function AuditScheduleManager() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [leads, setLeads] = useState<LeadLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  // New-audit form
  const [date, setDate] = useState(todayStr());
  const [title, setTitle] = useState('');
  const [scope, setScope] = useState<'all' | 'selected'>('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function load() {
    Promise.all([
      fetch('/api/audits?manage=1').then(r => r.json()),
      fetch('/api/leads').then(r => r.json()),
    ]).then(([a, l]) => {
      setAudits(Array.isArray(a?.audits) ? a.audits : []);
      const active = (Array.isArray(l) ? l : []).filter((x: any) => x.stage !== 'closed_won' && x.stage !== 'closed_lost');
      setLeads(active.map((x: any) => ({ id: x.id, company_name: x.company_name, assigned_name: x.assigned_name, stage: x.stage })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }
  useEffect(load, []);

  const lastAuditDate = audits.length ? audits[0].audit_date : null;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? leads.filter(l => l.company_name.toLowerCase().includes(q) || (l.assigned_name || '').toLowerCase().includes(q)) : leads;
  }, [leads, search]);

  function toggle(id: number) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function selectAllFiltered() { setSelected(s => { const n = new Set(s); filtered.forEach(l => n.add(l.id)); return n; }); }
  function clearSelection() { setSelected(new Set()); }

  function resetForm() { setDate(todayStr()); setTitle(''); setScope('all'); setSelected(new Set()); setSearch(''); setError(''); setAdding(false); }

  async function create() {
    setError('');
    if (!date) { setError('Pick an audit date.'); return; }
    if (scope === 'selected' && selected.size === 0) { setError('Select at least one lead.'); return; }
    setSaving(true);
    const res = await fetch('/api/audits', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audit_date: date, title: title.trim() || null, scope, lead_ids: Array.from(selected) }),
    });
    setSaving(false);
    if (res.ok) { resetForm(); load(); }
    else { const d = await res.json().catch(() => ({})); setError(d.error || 'Could not create audit.'); }
  }

  async function remove(id: number) {
    if (!confirm('Delete this audit and all its responses?')) return;
    await fetch(`/api/audits/${id}`, { method: 'DELETE' });
    load();
  }
  async function toggleClosed(a: Audit) {
    await fetch(`/api/audits/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_closed: !a.is_closed }) });
    load();
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-slate-800">Scheduled Audits</h2>
        {!adding && <button type="button" onClick={() => setAdding(true)} className="btn-secondary text-xs">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          New audit
        </button>}
      </div>
      <p className="text-sm text-slate-400 mb-4">Create an audit on a date — it covers the period since your last audit, for all active leads or a set you pick. Reps then complete it per lead.</p>

      {adding && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-4 space-y-3 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Audit date</label>
              <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Title (optional)</label>
              <input className="input" placeholder="e.g. Q3 mid-quarter review" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
          </div>
          <div className="text-xs text-slate-500">
            Covers <span className="font-medium text-slate-700">{lastAuditDate ? formatDate(lastAuditDate) : 'the beginning'}</span> → <span className="font-medium text-slate-700">{date ? formatDate(date) : '…'}</span>
          </div>

          <div>
            <label className="label">Which leads?</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setScope('all')} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${scope === 'all' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200'}`}>All active leads ({leads.length})</button>
              <button type="button" onClick={() => setScope('selected')} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${scope === 'selected' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200'}`}>Select leads</button>
            </div>
          </div>

          {scope === 'selected' && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <input className="input flex-1 text-sm" placeholder="Search leads…" value={search} onChange={e => setSearch(e.target.value)} />
                <button type="button" onClick={selectAllFiltered} className="text-xs text-brand-600 hover:underline whitespace-nowrap">Select all</button>
                <button type="button" onClick={clearSelection} className="text-xs text-slate-400 hover:underline whitespace-nowrap">Clear</button>
              </div>
              <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <div className="p-3 text-xs text-slate-400 text-center">No leads match.</div>
                ) : filtered.map(l => (
                  <label key={l.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} className="rounded border-slate-300" />
                    <span className="text-sm text-slate-700 flex-1 truncate">{l.company_name}</span>
                    {l.assigned_name && <span className="text-xs text-slate-400">{l.assigned_name}</span>}
                  </label>
                ))}
              </div>
              <div className="text-xs text-slate-400 mt-1">{selected.size} selected</div>
            </div>
          )}

          {error && <div className="text-xs text-rose-600">{error}</div>}
          <div className="flex items-center gap-2">
            <button type="button" onClick={create} className="btn-primary text-sm" disabled={saving}>{saving ? 'Creating…' : 'Create audit'}</button>
            <button type="button" onClick={resetForm} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : audits.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No audits scheduled yet.</p>
      ) : (
        <div className="space-y-2">
          {audits.map(a => {
            const pct = a.target_count > 0 ? Math.round((a.done_count / a.target_count) * 100) : 100;
            return (
              <div key={a.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800">
                      {a.title || `Audit · ${formatDate(a.audit_date)}`}
                      {!!a.is_closed && <span className="badge bg-slate-100 text-slate-500 border-slate-200 ml-2">Closed</span>}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {a.period_start ? `${formatDate(a.period_start)} – ` : 'Up to '}{formatDate(a.audit_date)} · {a.scope === 'all' ? 'all leads' : 'selected'} · {a.done_count}/{a.target_count} done
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden max-w-xs">
                      <div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <button type="button" onClick={() => toggleClosed(a)} className="text-xs font-medium px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100">{a.is_closed ? 'Reopen' : 'Close'}</button>
                  <button type="button" onClick={() => remove(a.id)} title="Delete" className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
