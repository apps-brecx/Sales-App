'use client';
import { useEffect, useState } from 'react';

function parseList(s: any): string[] { try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } }

export default function LeadCategorySettings() {
  const [items, setItems] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    fetch('/api/settings').then(r => r.json()).then(d => { const l = parseList(d?.lead_categories); setItems(l); setDrafts({}); setLoading(false); }).catch(() => setLoading(false));
  }
  useEffect(load, []);

  async function call(body: any) {
    setBusy(true);
    const res = await fetch('/api/lead-categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setBusy(false);
    if (res.ok) { const d = await res.json(); setItems(d.list || []); setDrafts({}); }
  }
  const add = () => { const v = val.trim(); if (!v || items.includes(v)) { setVal(''); return; } call({ action: 'add', name: v }); setVal(''); };
  const remove = (name: string) => { if (confirm(`Remove category "${name}"?`)) call({ action: 'remove', name }); };
  const rename = (i: number) => { const to = (drafts[i] ?? items[i]).trim(); const from = items[i]; if (!to || to === from) { setDrafts(d => { const n = { ...d }; delete n[i]; return n; }); return; } call({ action: 'rename', from, to }); };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-slate-800">Lead categories</h2>
        {busy && <span className="text-xs text-slate-400">Saving…</span>}
      </div>
      <p className="text-sm text-slate-400 mb-4">Add, rename, or remove categories — e.g. national stores (Walmart), national distributors (Sysco), local. Renaming updates existing leads too.</p>

      {loading ? <div className="h-10 bg-slate-100 rounded-xl animate-pulse" /> : (
        <>
          <div className="space-y-2 mb-3">
            {items.map((it, i) => {
              const editing = drafts[i] !== undefined && drafts[i] !== it;
              return (
                <div key={i} className="flex items-center gap-2">
                  <input className="input flex-1 text-sm" value={drafts[i] ?? it} onChange={e => setDrafts(d => ({ ...d, [i]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') rename(i); }} />
                  {editing && <button type="button" onClick={() => rename(i)} className="btn-primary text-xs">Save</button>}
                  <button type="button" onClick={() => remove(it)} className="px-2 text-slate-300 hover:text-rose-500" title="Remove"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                </div>
              );
            })}
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
