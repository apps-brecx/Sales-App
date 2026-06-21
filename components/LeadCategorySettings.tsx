'use client';
import { useEffect, useState } from 'react';

function parseList(s: any): string[] { try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } }

export default function LeadCategorySettings() {
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => { setItems(parseList(d?.lead_categories)); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function persist(next: string[]) {
    setItems(next); setSaving(true); setSaved(false);
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_categories: JSON.stringify(next) }) });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }
  function add() { const v = val.trim(); if (!v || items.includes(v)) { setVal(''); return; } persist([...items, v]); setVal(''); }
  function remove(i: number) { persist(items.filter((_, idx) => idx !== i)); }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-slate-800">Lead categories</h2>
        {saving ? <span className="text-xs text-slate-400">Saving…</span> : saved ? <span className="text-xs text-emerald-600">Saved</span> : null}
      </div>
      <p className="text-sm text-slate-400 mb-4">Group leads — e.g. national stores (Walmart), national distributors (Sysco), local. Used when importing to the pool and filtering leads.</p>

      {loading ? <div className="h-10 bg-slate-100 rounded-xl animate-pulse" /> : (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            {items.map((it, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-sm bg-violet-50 text-violet-700 border border-violet-200 rounded-full pl-3 pr-1.5 py-1">
                {it}
                <button type="button" onClick={() => remove(i)} className="text-violet-400 hover:text-rose-500" title="Remove"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
              </span>
            ))}
            {items.length === 0 && <span className="text-sm text-slate-400">No categories yet.</span>}
          </div>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Add a category…" value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
            <button type="button" onClick={add} className="btn-secondary" disabled={!val.trim()}>Add</button>
          </div>
        </>
      )}
    </div>
  );
}
