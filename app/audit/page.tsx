'use client';
import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import StageBadge from '@/components/StageBadge';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { formatDate, timeAgo } from '@/lib/utils';
import { LeadStage } from '@/types';

type Cycle = { index: number; start: string; end: string; due: string; pending: boolean; daysUntilStart: number };
type RawQuestion = { id: number; prompt: string; options: string; allow_other: number };
type Question = { id: number; prompt: string; options: string[]; allow_other: boolean };
type AuditLead = {
  id: number; company_name: string; contact_name: string | null; stage: LeadStage; updated_at: string;
  audit_id: number | null; answers: string | null; plan_text: string | null;
  prev_plan_status: string | null; prev_plan_note: string | null; audit_updated_at: string | null;
  prev_plan_text: string | null; prev_cycle_start: string | null;
};

const PLAN_STATUS_META: Record<string, { label: string; chip: string; tone: 'emerald' | 'amber' | 'rose' }> = {
  executed: { label: 'Executed', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', tone: 'emerald' },
  partly:   { label: 'Partly done', chip: 'bg-amber-50 text-amber-700 border-amber-200', tone: 'amber' },
  not:      { label: 'Not done', chip: 'bg-rose-50 text-rose-700 border-rose-200', tone: 'rose' },
};

function parseList(s: any): string[] { try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } }
function parseAnswers(s: any): Record<string, string> {
  if (s && typeof s === 'object') return s;
  try { const a = JSON.parse(s || '{}'); return a && typeof a === 'object' ? a : {}; } catch { return {}; }
}

export default function AuditPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const isStaff = role === 'admin' || role === 'manager';

  return (
    <AppShell>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="page-title">Lead Audits</h1>
          <p className="page-sub">Every two weeks, review each active lead — answer a few quick questions, check whether last cycle's plan was carried out, and set the next plan of action.</p>
        </div>
        {isStaff ? <StaffView /> : <RepView />}
      </div>
    </AppShell>
  );
}

function Pill({ active, onClick, children, tone = 'brand' }: { active: boolean; onClick: () => void; children: React.ReactNode; tone?: 'brand' | 'emerald' | 'amber' | 'rose' }) {
  const tones: Record<string, string> = {
    brand:   active ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300',
    emerald: active ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300',
    amber:   active ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300',
    rose:    active ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300',
  };
  return <button type="button" onClick={onClick} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${tones[tone]}`}>{children}</button>;
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
            You'll review each active lead and set a plan of action once it opens.
          </div>
        </div>
      </div>
    </div>
  );
}

function RepView() {
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [leads, setLeads] = useState<AuditLead[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch('/api/audits').then(r => r.json()).then(d => {
      setCycle(d.cycle);
      setQuestions((d.questions || []).map((q: RawQuestion) => ({ id: q.id, prompt: q.prompt, options: parseList(q.options), allow_other: !!q.allow_other })));
      setLeads(Array.isArray(d.leads) ? d.leads : []);
      setLoading(false);
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
          {leads.map(l => <AuditCard key={l.id} lead={l} questions={questions} onSaved={load} />)}
        </div>
      )}
    </>
  );
}

function AuditCard({ lead, questions, onSaved }: { lead: AuditLead; questions: Question[]; onSaved: () => void }) {
  const saved = useMemo(() => parseAnswers(lead.answers), [lead.answers]);
  const isDone = !!lead.audit_id;
  const hasPrev = !!lead.prev_plan_text;

  // Per-question choice ('' | option | '__other__') and free-text for "Other".
  const initChoice: Record<string, string> = {};
  const initOther: Record<string, string> = {};
  for (const q of questions) {
    const v = saved[String(q.id)] || '';
    if (!v) { initChoice[q.id] = ''; }
    else if (q.options.includes(v)) { initChoice[q.id] = v; }
    else { initChoice[q.id] = '__other__'; initOther[q.id] = v; }
  }

  const [choice, setChoice] = useState<Record<string, string>>(initChoice);
  const [other, setOther] = useState<Record<string, string>>(initOther);
  const [planText, setPlanText] = useState(lead.plan_text || '');
  const [prevStatus, setPrevStatus] = useState(lead.prev_plan_status || '');
  const [prevNote, setPrevNote] = useState(lead.prev_plan_note || '');
  const [open, setOpen] = useState(!isDone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const finalValue = (q: Question) => (choice[q.id] === '__other__' ? (other[q.id] || '').trim() : (choice[q.id] || ''));

  const snapshot = JSON.stringify({
    a: questions.map(q => finalValue(q)), p: planText.trim(), s: prevStatus, n: prevNote.trim(),
  });
  const initialSnapshot = useMemo(() => JSON.stringify({
    a: questions.map(q => (saved[String(q.id)] || '').trim()), p: (lead.plan_text || '').trim(),
    s: lead.prev_plan_status || '', n: (lead.prev_plan_note || '').trim(),
  }), [questions, saved, lead.plan_text, lead.prev_plan_status, lead.prev_plan_note]);
  const dirty = snapshot !== initialSnapshot;

  const allAnswered = questions.every(q => finalValue(q));
  const prevOk = !hasPrev || !!prevStatus;
  const valid = allAnswered && !!planText.trim() && prevOk;

  async function save() {
    if (!valid) { setError(!planText.trim() ? 'Add a plan of action.' : !allAnswered ? 'Answer all the questions.' : 'Mark whether last plan was done.'); return; }
    setSaving(true); setError('');
    const answers: Record<string, string> = {};
    for (const q of questions) answers[String(q.id)] = finalValue(q);
    const res = await fetch('/api/audits', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: lead.id, answers, plan_text: planText, prev_plan_status: prevStatus || null, prev_plan_note: prevNote }),
    });
    setSaving(false);
    if (res.ok) { onSaved(); }
    else { const d = await res.json().catch(() => ({})); setError(d.error || 'Could not save.'); }
  }

  return (
    <div className={`card p-4 ${isDone && !dirty ? 'border-emerald-200' : ''}`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 text-left">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isDone ? 'bg-emerald-500' : 'border-2 border-slate-300'}`}>
          {isDone && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-800 truncate">{lead.company_name}</div>
          <div className="text-xs text-slate-400 truncate">
            {lead.contact_name ? lead.contact_name + ' · ' : ''}
            {isDone ? `audited ${lead.audit_updated_at ? timeAgo(lead.audit_updated_at) : ''}` : 'needs audit'}
          </div>
        </div>
        <StageBadge stage={lead.stage} />
        <svg className={`w-4 h-4 text-slate-300 transition-transform shrink-0 ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
      </button>

      {open && (
        <div className="mt-4 pl-9 space-y-5">
          {/* 1 — Review last cycle's plan */}
          {hasPrev && (
            <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-600 mb-1">Last cycle's plan{lead.prev_cycle_start ? ` · ${formatDate(lead.prev_cycle_start)}` : ''}</div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap mb-3">{lead.prev_plan_text}</p>
              <div className="text-xs font-semibold text-slate-600 mb-1.5">Was it carried out?</div>
              <div className="flex flex-wrap gap-2">
                {(['executed', 'partly', 'not'] as const).map(s => (
                  <Pill key={s} active={prevStatus === s} onClick={() => setPrevStatus(s)} tone={PLAN_STATUS_META[s].tone}>{PLAN_STATUS_META[s].label}</Pill>
                ))}
              </div>
              {prevStatus && prevStatus !== 'executed' && (
                <input className="input mt-2 text-sm" placeholder="What happened / why not? (optional)" value={prevNote} onChange={e => setPrevNote(e.target.value)} />
              )}
            </div>
          )}

          {/* 2 — Questions */}
          {questions.length > 0 && (
            <div className="space-y-4">
              {questions.map(q => {
                const isOther = choice[q.id] === '__other__';
                return (
                  <div key={q.id}>
                    <div className="text-sm font-medium text-slate-700 mb-2">{q.prompt}</div>
                    <div className="flex flex-wrap gap-2">
                      {q.options.map(opt => (
                        <Pill key={opt} active={choice[q.id] === opt} onClick={() => setChoice(c => ({ ...c, [q.id]: opt }))}>{opt}</Pill>
                      ))}
                      {q.allow_other && (
                        <Pill active={isOther} onClick={() => setChoice(c => ({ ...c, [q.id]: '__other__' }))}>Other…</Pill>
                      )}
                    </div>
                    {isOther && (
                      <input className="input mt-2 text-sm" placeholder="Type your answer" value={other[q.id] || ''} onChange={e => setOther(o => ({ ...o, [q.id]: e.target.value }))} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 3 — Plan of action */}
          <div>
            <label className="label">Plan of action — next steps for this lead</label>
            <textarea className="input min-h-[90px]" placeholder="What will you do to move this lead forward before the next audit?"
              value={planText} onChange={e => setPlanText(e.target.value)} />
          </div>

          {error && <div className="text-xs text-rose-600">{error}</div>}
          <div className="flex items-center gap-3">
            <button onClick={save} className="btn-primary" disabled={saving || !dirty || !valid}>
              {saving ? 'Saving…' : isDone ? 'Update audit' : 'Save audit'}
            </button>
            {isDone && !dirty && <span className="text-xs text-emerald-600 font-medium">Saved ✓</span>}
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
  const [data, setData] = useState<{ questions: Question[]; leads: AuditLead[] } | null>(null);
  useEffect(() => {
    fetch(`/api/audits?user_id=${userId}`).then(r => r.json()).then(d => setData({
      questions: (d.questions || []).map((q: RawQuestion) => ({ id: q.id, prompt: q.prompt, options: parseList(q.options), allow_other: !!q.allow_other })),
      leads: Array.isArray(d.leads) ? d.leads : [],
    })).catch(() => setData({ questions: [], leads: [] }));
  }, [userId]);

  if (data === null) return <div className="mt-3 h-12 animate-pulse bg-slate-50 rounded-lg" />;
  if (data.leads.length === 0) return <div className="mt-3 text-xs text-slate-400">No active leads.</div>;

  const promptOf = (id: string) => data.questions.find(q => String(q.id) === id)?.prompt || 'Question';

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-4">
      {data.leads.map(l => {
        const answers = parseAnswers(l.answers);
        const status = l.prev_plan_status ? PLAN_STATUS_META[l.prev_plan_status] : null;
        return (
          <div key={l.id} className="text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/leads/${l.id}`} className="font-medium text-slate-700 hover:text-brand-600">{l.company_name}</Link>
              <StageBadge stage={l.stage} />
              {!l.audit_id && <span className="text-xs text-rose-500 font-medium">not audited</span>}
            </div>
            {l.audit_id && (
              <div className="mt-1.5 pl-1 space-y-2">
                {Object.keys(answers).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(answers).map(([qid, val]) => (
                      <span key={qid} className="inline-flex items-center gap-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                        <span className="text-slate-400">{promptOf(qid)}:</span>
                        <span className="text-slate-700 font-medium">{val}</span>
                      </span>
                    ))}
                  </div>
                )}
                {status && (
                  <div className="text-xs">
                    <span className="text-slate-400">Last plan: </span>
                    <span className={`inline-flex items-center badge border ${status.chip}`}>{status.label}</span>
                    {l.prev_plan_note && <span className="text-slate-500"> — {l.prev_plan_note}</span>}
                  </div>
                )}
                <div className="text-xs"><span className="font-semibold text-slate-500">Plan:</span> <span className="text-slate-600 whitespace-pre-wrap">{l.plan_text}</span></div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
