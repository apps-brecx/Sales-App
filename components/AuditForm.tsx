'use client';
import { useMemo, useState } from 'react';
import { formatDate } from '@/lib/utils';

export type AuditQuestion = { id: number; prompt: string; options: string[]; allow_other: boolean };
export type AuditItem = {
  audit_id: number; audit_date: string; period_start: string | null; title: string | null;
  lead_id: number; company_name: string; contact_name: string | null; stage: string; updated_at: string;
  response_id: number | null; answers: string | null; plan_text: string | null;
  prev_plan_status: string | null; prev_plan_note: string | null; response_updated_at: string | null;
  prev_plan_text: string | null; prev_audit_date: string | null;
};

const PLAN_STATUS_META: Record<string, { label: string; tone: 'emerald' | 'amber' | 'rose' }> = {
  executed: { label: 'Executed', tone: 'emerald' },
  partly:   { label: 'Partly done', tone: 'amber' },
  not:      { label: 'Not done', tone: 'rose' },
};

export function parseList(s: any): string[] { try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } }
export function parseAnswers(s: any): Record<string, string> {
  if (s && typeof s === 'object') return s;
  try { const a = JSON.parse(s || '{}'); return a && typeof a === 'object' ? a : {}; } catch { return {}; }
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

export default function AuditForm({ item, questions, onSaved }: { item: AuditItem; questions: AuditQuestion[]; onSaved: () => void }) {
  const saved = useMemo(() => parseAnswers(item.answers), [item.answers]);
  const isDone = !!item.response_id;
  const hasPrev = !!item.prev_plan_text;

  const initChoice: Record<string, string> = {};
  const initOther: Record<string, string> = {};
  for (const q of questions) {
    const v = saved[String(q.id)] || '';
    if (!v) initChoice[q.id] = '';
    else if (q.options.includes(v)) initChoice[q.id] = v;
    else { initChoice[q.id] = '__other__'; initOther[q.id] = v; }
  }

  const [choice, setChoice] = useState<Record<string, string>>(initChoice);
  const [other, setOther] = useState<Record<string, string>>(initOther);
  const [planText, setPlanText] = useState(item.plan_text || '');
  const [prevStatus, setPrevStatus] = useState(item.prev_plan_status || '');
  const [prevNote, setPrevNote] = useState(item.prev_plan_note || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const finalValue = (q: AuditQuestion) => (choice[q.id] === '__other__' ? (other[q.id] || '').trim() : (choice[q.id] || ''));

  const snapshot = JSON.stringify({ a: questions.map(finalValue), p: planText.trim(), s: prevStatus, n: prevNote.trim() });
  const initialSnapshot = useMemo(() => JSON.stringify({
    a: questions.map(q => (saved[String(q.id)] || '').trim()), p: (item.plan_text || '').trim(),
    s: item.prev_plan_status || '', n: (item.prev_plan_note || '').trim(),
  }), [questions, saved, item.plan_text, item.prev_plan_status, item.prev_plan_note]);
  const dirty = snapshot !== initialSnapshot;

  const allAnswered = questions.every(q => finalValue(q));
  const prevOk = !hasPrev || !!prevStatus;
  const valid = allAnswered && !!planText.trim() && prevOk;

  async function save() {
    if (!valid) { setError(!planText.trim() ? 'Add a plan of action.' : !allAnswered ? 'Answer all the questions.' : 'Mark whether last plan was done.'); return; }
    setSaving(true); setError('');
    const answers: Record<string, string> = {};
    for (const q of questions) answers[String(q.id)] = finalValue(q);
    const res = await fetch('/api/audit-responses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audit_id: item.audit_id, lead_id: item.lead_id, answers, plan_text: planText, prev_plan_status: prevStatus || null, prev_plan_note: prevNote }),
    });
    setSaving(false);
    if (res.ok) onSaved();
    else { const d = await res.json().catch(() => ({})); setError(d.error || 'Could not save.'); }
  }

  return (
    <div className="space-y-5">
      {/* 1 — Review last plan */}
      {hasPrev && (
        <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-600 mb-1">Last plan{item.prev_audit_date ? ` · ${formatDate(item.prev_audit_date)}` : ''}</div>
          <p className="text-sm text-slate-700 whitespace-pre-wrap mb-3">{item.prev_plan_text}</p>
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
                  {q.allow_other && <Pill active={isOther} onClick={() => setChoice(c => ({ ...c, [q.id]: '__other__' }))}>Other…</Pill>}
                </div>
                {isOther && <input className="input mt-2 text-sm" placeholder="Type your answer" value={other[q.id] || ''} onChange={e => setOther(o => ({ ...o, [q.id]: e.target.value }))} />}
              </div>
            );
          })}
        </div>
      )}

      {/* 3 — Plan of action */}
      <div>
        <label className="label">Plan of action — next steps for this lead</label>
        <textarea className="input min-h-[90px]" placeholder="What will you do to move this lead forward before the next audit?" value={planText} onChange={e => setPlanText(e.target.value)} />
      </div>

      {error && <div className="text-xs text-rose-600">{error}</div>}
      <div className="flex items-center gap-3">
        <button onClick={save} className="btn-primary" disabled={saving || !dirty || !valid}>
          {saving ? 'Saving…' : isDone ? 'Update audit' : 'Finish audit'}
        </button>
        {isDone && !dirty && <span className="text-xs text-emerald-600 font-medium">Done ✓</span>}
      </div>
    </div>
  );
}
