'use client';
import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { timeAgo } from '@/lib/utils';

function parseList(s: any): string[] { try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } }

export default function PoolPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const isStaff = role === 'admin' || role === 'manager';

  const [leads, setLeads] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [cat, setCat] = useState('all');
  const [loading, setLoading] = useState(true);
  const [grabbing, setGrabbing] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch('/api/leads/pool').then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
    ]).then(([pool, settings]) => {
      setLeads(Array.isArray(pool) ? pool : []);
      setCategories(parseList(settings?.lead_categories));
      setLoading(false);
    }).catch(() => setLoading(false));
  }
  useEffect(load, []);

  const shown = useMemo(() => cat === 'all' ? leads : leads.filter(l => (l.category || 'Uncategorized') === cat), [leads, cat]);

  async function grab(id: number) {
    setGrabbing(id);
    const res = await fetch('/api/leads/grab', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setGrabbing(null);
    if (res.ok) setLeads(ls => ls.filter(l => l.id !== id));
    else { const d = await res.json().catch(() => ({})); alert(d.error || 'Could not grab'); load(); }
  }

  const counts: Record<string, number> = {};
  for (const l of leads) { const k = l.category || 'Uncategorized'; counts[k] = (counts[k] || 0) + 1; }

  return (
    <AppShell>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="page-title">Lead Pool</h1>
            <p className="page-sub">Unassigned leads — grab one to add it to your leads and start working it.</p>
          </div>
          {isStaff && <button onClick={() => setImportOpen(true)} className="btn-primary shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            Import leads
          </button>}
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          <button onClick={() => setCat('all')} className={chip(cat === 'all')}>All <span className="opacity-60">{leads.length}</span></button>
          {categories.map(c => <button key={c} onClick={() => setCat(c)} className={chip(cat === c)}>{c} <span className="opacity-60">{counts[c] || 0}</span></button>)}
          {counts['Uncategorized'] && <button onClick={() => setCat('Uncategorized')} className={chip(cat === 'Uncategorized')}>Uncategorized <span className="opacity-60">{counts['Uncategorized']}</span></button>}
        </div>

        {loading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}</div>
        ) : shown.length === 0 ? (
          <div className="card p-12 text-center text-slate-400">No leads in the pool here. {isStaff ? 'Import some to get started.' : 'Check back soon.'}</div>
        ) : (
          <div className="space-y-2">
            {shown.map(l => (
              <div key={l.id} className="card p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 font-bold flex items-center justify-center shrink-0">{l.company_name[0]?.toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/leads/${l.id}`} className="text-sm font-semibold text-slate-800 hover:text-brand-600 truncate">{l.company_name}</Link>
                    {l.category && <span className="badge bg-violet-50 text-violet-700 border-violet-200">{l.category}</span>}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{[l.contact_name, l.contact_email, l.value && `💰 ${l.value}`].filter(Boolean).join(' · ') || 'No contact details'}</div>
                </div>
                <div className="text-xs text-slate-400 hidden sm:block">{l.created_at ? `added ${timeAgo(l.created_at)}` : ''}</div>
                {role !== 'viewer' && <button onClick={() => grab(l.id)} disabled={grabbing === l.id} className="btn-primary shrink-0">{grabbing === l.id ? 'Grabbing…' : 'Grab'}</button>}
              </div>
            ))}
          </div>
        )}
      </div>

      {importOpen && <ImportModal categories={categories} onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); load(); }} />}
    </AppShell>
  );
}

function chip(active: boolean) {
  return `px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`;
}

function ImportModal({ categories, onClose, onDone }: { categories: string[]; onClose: () => void; onDone: () => void }) {
  const [category, setCategory] = useState(categories[0] || '');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function run() {
    setBusy(true); setMsg('');
    const res = await fetch('/api/leads/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category, text }) });
    const d = await res.json(); setBusy(false);
    if (res.ok) { setMsg(`Imported ${d.created} leads.`); setTimeout(onDone, 700); }
    else setMsg(d.error || 'Import failed');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-slate-800">Import leads to the pool</h2><button onClick={onClose} className="text-slate-300 hover:text-slate-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button></div>
        <div className="space-y-3">
          <div>
            <label className="label">Category</label>
            <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
              {categories.length === 0 && <option value="">Uncategorized</option>}
            </select>
          </div>
          <div>
            <label className="label">Leads — one per line</label>
            <textarea className="input min-h-[160px] font-mono text-xs" placeholder={`Company, Contact, Email, Phone, Value\nWalmart Bentonville, Jane Doe, jane@walmart.com, 555-0100, $50k\nKroger Cincinnati, , buyer@kroger.com`} value={text} onChange={e => setText(e.target.value)} />
            <p className="text-xs text-slate-400 mt-1">Comma or tab separated. Only the company name is required. They land unassigned for reps to grab.</p>
          </div>
          {msg && <div className="text-sm text-slate-600">{msg}</div>}
          <div className="flex gap-2 pt-1"><button onClick={run} className="btn-primary flex-1 justify-center" disabled={busy || !text.trim()}>{busy ? 'Importing…' : 'Import'}</button><button onClick={onClose} className="btn-secondary">Cancel</button></div>
        </div>
      </div>
    </div>
  );
}
