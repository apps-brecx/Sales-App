'use client';
import { useEffect, useState } from 'react';

type Question = { id: number; prompt: string; options: string; allow_other: number; is_active: number };
type Draft = { prompt: string; options: string[]; allow_other: boolean };

function parseList(s: any): string[] { try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } }
const EMPTY: Draft = { prompt: '', options: [''], allow_other: true };

export default function AuditQuestionsManager() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);

  function load() {
    fetch('/api/audit-questions').then(r => r.json()).then(d => {
      setQuestions(Array.isArray(d) ? d : []); setLoading(false);
    }).catch(() => setLoading(false));
  }
  useEffect(load, []);

  function startAdd() { setDraft(EMPTY); setEditingId('new'); }
  function startEdit(q: Question) {
    const opts = parseList(q.options);
    setDraft({ prompt: q.prompt, options: opts.length ? opts : [''], allow_other: !!q.allow_other });
    setEditingId(q.id);
  }
  function cancel() { setEditingId(null); setDraft(EMPTY); }

  async function saveDraft() {
    const prompt = draft.prompt.trim();
    const options = draft.options.map(o => o.trim()).filter(Boolean);
    if (!prompt) return;
    setSaving(true);
    const payload = { prompt, options, allow_other: draft.allow_other };
    const res = editingId === 'new'
      ? await fetch('/api/audit-questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch(`/api/audit-questions/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false);
    if (res.ok) { cancel(); load(); }
  }

  async function remove(id: number) {
    if (!confirm('Delete this question? Past answers stay on record.')) return;
    await fetch(`/api/audit-questions/${id}`, { method: 'DELETE' });
    load();
  }
  async function toggleActive(q: Question) {
    await fetch(`/api/audit-questions/${q.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !q.is_active }) });
    load();
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-slate-800">Audit Questions</h2>
        {editingId === null && (
          <button type="button" onClick={startAdd} className="btn-secondary text-xs">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Add question
          </button>
        )}
      </div>
      <p className="text-sm text-slate-400 mb-4">Questions each rep answers for every lead during the bi-weekly audit. Give preset answers; reps can also pick “Other” and type their own.</p>

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-2">
          {editingId === 'new' && <QuestionEditor draft={draft} setDraft={setDraft} onSave={saveDraft} onCancel={cancel} saving={saving} />}

          {questions.map(q => (
            editingId === q.id ? (
              <QuestionEditor key={q.id} draft={draft} setDraft={setDraft} onSave={saveDraft} onCancel={cancel} saving={saving} />
            ) : (
              <div key={q.id} className={`rounded-xl border p-3 ${q.is_active ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-70'}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800">{q.prompt}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {parseList(q.options).map((o, i) => (
                        <span key={i} className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{o}</span>
                      ))}
                      {!!q.allow_other && <span className="text-xs text-slate-400 px-1 py-0.5">+ Other</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => toggleActive(q)} title={q.is_active ? 'Active — click to disable' : 'Disabled — click to enable'}
                      className={`text-xs font-medium px-2 py-1 rounded-lg ${q.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                      {q.is_active ? 'Active' : 'Off'}
                    </button>
                    <button type="button" onClick={() => startEdit(q)} title="Edit" className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-50 rounded-lg">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button type="button" onClick={() => remove(q.id)} title="Delete" className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          ))}

          {questions.length === 0 && editingId === null && (
            <p className="text-sm text-slate-400 text-center py-4">No questions yet — add one above.</p>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionEditor({ draft, setDraft, onSave, onCancel, saving }: { draft: Draft; setDraft: (d: Draft) => void; onSave: () => void; onCancel: () => void; saving: boolean }) {
  const setOption = (i: number, v: string) => setDraft({ ...draft, options: draft.options.map((o, idx) => idx === i ? v : o) });
  const addOption = () => setDraft({ ...draft, options: [...draft.options, ''] });
  const removeOption = (i: number) => setDraft({ ...draft, options: draft.options.filter((_, idx) => idx !== i) });
  const canSave = draft.prompt.trim() && draft.options.some(o => o.trim());

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-4 space-y-3">
      <div>
        <label className="label">Question</label>
        <input className="input" placeholder="e.g. How likely is this lead to close?" value={draft.prompt} onChange={e => setDraft({ ...draft, prompt: e.target.value })} autoFocus />
      </div>
      <div>
        <label className="label">Preset answers</label>
        <div className="space-y-2">
          {draft.options.map((o, i) => (
            <div key={i} className="flex gap-2">
              <input className="input flex-1 text-sm" placeholder={`Answer ${i + 1}`} value={o} onChange={e => setOption(i, e.target.value)} />
              <button type="button" onClick={() => removeOption(i)} disabled={draft.options.length <= 1} className="px-2 text-slate-300 hover:text-rose-500 disabled:opacity-30" title="Remove">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addOption} className="text-xs text-brand-600 hover:underline mt-2">+ Add answer</button>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={draft.allow_other} onChange={e => setDraft({ ...draft, allow_other: e.target.checked })} className="rounded border-slate-300" />
        Allow “Other” — let reps type a custom answer
      </label>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onSave} className="btn-primary text-sm" disabled={saving || !canSave}>{saving ? 'Saving…' : 'Save question'}</button>
        <button type="button" onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );
}
