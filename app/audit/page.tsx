'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import StageBadge from '@/components/StageBadge';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { formatDate, timeAgo } from '@/lib/utils';
import { LeadStage } from '@/types';

type Cycle = { index: number; start: string; end: string; due: string; pending: boolean; daysUntilStart: number };
type AuditLead = {
  id: number; company_name: string; contact_name: string | null; stage: LeadStage; updated_at: string;
  audit_id: number | null; status_text: string | null; plan_text: string | null; audit_updated_at: string | null;
};

export default function AuditPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const isStaff = role === 'admin' || role === 'manager';

  return (
    <AppShell>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="page-title">Lead Audits</h1>
          <p className="page-sub">Every two weeks, go over each active lead and record its current status and a full plan of action.</p>
        </div>
        {isStaff ? <StaffView /> : <RepView />}
      </div>
    </AppShell>
  );
}

function CycleHeader({ cycle, done, total }: { cycle: Cycle; done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="card p-5 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-600 mb-1">Current Cycle</div>
          <div className="text-lg font-bold text-slate-900">{formatDate(cycle.start)} – {formatDate(cycle.end)}</div>
          <div className="text-xs text-slate-400 mt-0.5">Due by {formatDate(cycle.due)}</div>
        </div>
        {total > 0 && (
          <div className="text-right">
            <div className="text-2xl font-bold text-slate-900">{done}<span className="text-slate-400 text-base font-medium">/{total}</span></div>
            <div className="text-xs text-slate-400">leads audited</div>
          </div>
        )}
      </div>
      {total > 0 && (
        <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function PendingBanner({ cycle }: { cycle: Cycle }) {
  return (
    <div className="card p-5 mb-6 border-amber-200 bg-amber-50/40">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-800">First audit cycle starts {formatDate(cycle.start)}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {cycle.daysUntilStart === 0 ? 'Opening today.' : `Opens in ${cycle.daysUntilStart} ${cycle.daysUntilStart === 1 ? 'day' : 'days'}. `}
            You'll be able to record a status and plan of action for each active lead once it opens.
          </div>
        </div>
      </div>
    </div>
  );
}

function RepView() {
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [leads, setLeads] = useState<AuditLead[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch('/api/audits').then(r => r.json()).then(d => {
      setCycle(d.cycle); setLeads(Array.isArray(d.leads) ? d.leads : []); setLoading(false);
    }).catch(() => setLoading(false));
  }
  useEffect(load, []);

  if (loading) return <div className="card p-8 animate-pulse h-40 bg-slate-100" />;
  if (!cycle) return <div className="card p-12 text-center text-slate-400">Could not load the audit cycle.</div>;

  const done = leads.filter(l => l.audit_id).length;

  if (cycle.pending) return <PendingBanner cycle={cycle} />;

  return (
    <>
      <CycleHeader cycle={cycle} done={done} total={leads.length} />
      {leads.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">No active leads assigned to you — nothing to audit this cycle.</div>
      ) : (
        <div className="space-y-3">
          {leads.map(l => (
            <AuditCard key={l.id} lead={l} onSaved={load} />
          ))}
        </div>
      )}
    </>
  );
}

function AuditCard({ lead, onSaved }: { lead: AuditLead; onSaved: () => void }) {
  const [statusText, setStatusText] = useState(lead.status_text || '');
  const [planText, setPlanText] = useState(lead.plan_text || '');
  const [open, setOpen] = useState(!lead.audit_id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isDone = !!lead.audit_id;
  const dirty = statusText !== (lead.status_text || '') || planText !== (lead.plan_text || '');

  async function save() {
    if (!statusText.trim() || !planText.trim()) { setError('Both fields are required.'); return; }
    setSaving(true); setError('');
    const res = await fetch('/api/audits', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: lead.id, status_text: statusText, plan_text: planText }),
    });
    setSaving(false);
    if (res.ok) { onSaved(); }
    else { const d = await res.json().catch(() => ({})); setError(d.error || 'Could not save.'); }
  }

  return (
    <div className={`card p-4 ${isDone && !dirty ? 'border-emerald-200' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isDone ? 'bg-emerald-500' : 'border-2 border-slate-300'}`}>
          {isDone && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
        </div>
        <div className="flex-1 min-w-0">
          <Link href={`/leads/${lead.id}`} className="text-sm font-semibold text-slate-800 hover:text-brand-600 truncate">{lead.company_name}</Link>
          {lead.contact_name && <span className="text-xs text-slate-400 ml-2">{lead.contact_name}</span>}
        </div>
        <StageBadge stage={lead.stage} />
        <button onClick={() => setOpen(o => !o)} className="text-slate-300 hover:text-slate-600 p-1" title={open ? 'Collapse' : 'Expand'}>
          <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>

      {!open && isDone && (
        <div className="text-xs text-slate-400 mt-2 pl-9">Audited {lead.audit_updated_at ? timeAgo(lead.audit_updated_at) : ''} · click to review or edit</div>
      )}

      {open && (
        <div className="mt-3 pl-9 space-y-3">
          <div>
            <label className="label">Current status</label>
            <textarea className="input min-h-[70px]" placeholder="Where does this lead stand right now?"
              value={statusText} onChange={e => setStatusText(e.target.value)} />
          </div>
          <div>
            <label className="label">Plan of action</label>
            <textarea className="input min-h-[90px]" placeholder="What are the next steps to move this lead forward?"
              value={planText} onChange={e => setPlanText(e.target.value)} />
          </div>
          {error && <div className="text-xs text-rose-600">{error}</div>}
          <div className="flex items-center gap-3">
            <button onClick={save} className="btn-primary" disabled={saving || !dirty}>
              {saving ? 'Saving…' : isDone ? 'Update audit' : 'Save audit'}
            </button>
            {isDone && !dirty && <span className="text-xs text-emerald-600 font-medium">Saved</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function StaffView() {
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [overview, setOverview] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/audits?overview=1').then(r => r.json()).then(d => {
      setCycle(d.cycle); setOverview(Array.isArray(d.overview) ? d.overview : []); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="card p-8 animate-pulse h-40 bg-slate-100" />;
  if (!cycle) return <div className="card p-12 text-center text-slate-400">Could not load the audit cycle.</div>;

  return (
    <>
      <div className="card p-5 mb-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-brand-600 mb-1">Current Cycle</div>
        <div className="text-lg font-bold text-slate-900">{formatDate(cycle.start)} – {formatDate(cycle.end)}</div>
        <div className="text-xs text-slate-400 mt-0.5">{cycle.pending ? `Starts ${formatDate(cycle.start)}` : `Due by ${formatDate(cycle.due)}`}</div>
      </div>

      {overview.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">No active sales reps.</div>
      ) : (
        <div className="space-y-2">
          {overview.map(rep => {
            const active = Number(rep.active_leads) || 0;
            const audited = Number(rep.audited) || 0;
            const pct = active > 0 ? Math.round((audited / active) * 100) : 100;
            const isOpen = expanded === rep.id;
            return (
              <div key={rep.id} className="card p-4">
                <button onClick={() => setExpanded(isOpen ? null : rep.id)} className="w-full flex items-center gap-3 text-left">
                  <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center text-brand-700 font-bold text-sm shrink-0">{rep.name?.[0]?.toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800">{rep.name}</div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-slate-700 w-16 text-right">{audited}/{active}</div>
                  <svg className={`w-4 h-4 text-slate-300 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                </button>
                {isOpen && <StaffRepDetail userId={rep.id} />}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function StaffRepDetail({ userId }: { userId: number }) {
  const [leads, setLeads] = useState<AuditLead[] | null>(null);
  useEffect(() => {
    fetch(`/api/audits?user_id=${userId}`).then(r => r.json()).then(d => setLeads(Array.isArray(d.leads) ? d.leads : [])).catch(() => setLeads([]));
  }, [userId]);

  if (leads === null) return <div className="mt-3 h-12 animate-pulse bg-slate-50 rounded-lg" />;
  if (leads.length === 0) return <div className="mt-3 text-xs text-slate-400">No active leads.</div>;

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
      {leads.map(l => (
        <div key={l.id} className="text-sm">
          <div className="flex items-center gap-2">
            <Link href={`/leads/${l.id}`} className="font-medium text-slate-700 hover:text-brand-600">{l.company_name}</Link>
            <StageBadge stage={l.stage} />
            {!l.audit_id && <span className="text-xs text-rose-500 font-medium">· not audited</span>}
          </div>
          {l.audit_id && (
            <div className="mt-1 pl-1 space-y-1 text-xs">
              <div><span className="font-semibold text-slate-500">Status:</span> <span className="text-slate-600 whitespace-pre-wrap">{l.status_text}</span></div>
              <div><span className="font-semibold text-slate-500">Plan:</span> <span className="text-slate-600 whitespace-pre-wrap">{l.plan_text}</span></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
