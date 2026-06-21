'use client';
import { useEffect, useState } from 'react';

function parseList(s: any): string[] { try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } }

export default function NextActionSettings() {
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      setItems(parseList(d?.next_action_presets)); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function persist(next: string[]) {
    setItems(next); setSaving(true); setSaved(false);
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ next_action_presets: JSON.stringify(next) }) });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }
  function add() { const v = val.trim(); if (!v || items.includes(v)) { setVal(''); return; } persist([...items, v]); setVal(''); }
  function remove(i: number) { persist(items.filter((_, idx) => idx !== i)); }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-slate-800">Next-action presets</h2>
        {saving ? <span className="text-xs text-slate-400">Saving…</span> : saved ? <span className="text-xs text-emerald-600">Saved</span> : null}
      </div>
      <p className="text-sm text-slate-400 mb-4">Quick options reps can pick when setting the next action on a lead. They can still type a custom one.</p>

      {loading ? (
        <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            {items.map((it, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-sm bg-slate-100 text-slate-700 rounded-full pl-3 pr-1.5 py-1">
                {it}
                <button type="button" onClick={() => remove(i)} className="text-slate-400 hover:text-rose-500" title="Remove">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </span>
            ))}
            {items.length === 0 && <span className="text-sm text-slate-400">No presets yet.</span>}
          </div>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Add a next-action preset…" value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
            <button type="button" onClick={add} className="btn-secondary" disabled={!val.trim()}>Add</button>
          </div>
        </>
      )}
    </div>
  );
}
