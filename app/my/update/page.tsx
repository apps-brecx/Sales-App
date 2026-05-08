'use client';
import { useState } from 'react';
import AppShell from '@/components/AppShell';
import Link from 'next/link';

export default function MyUpdatePage() {
  const [emailText, setEmailText] = useState('');
  const [emailDate, setEmailDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handleParse(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setResult(null);
    const res = await fetch('/api/parse-email', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email_text: emailText, email_date: emailDate }) });
    setResult(await res.json());
    setLoading(false);
    if (res.ok) setEmailText('');
  }

  return (
    <AppShell>
      <div className="p-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="page-title">Submit Update</h1>
          <p className="page-sub">Type your update like an email — the AI logs each lead and what happened. Pick the date the update is for.</p>
        </div>

        {result && (
          <div className={`mb-6 rounded-2xl border p-5 animate-fade-in ${result.success ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
            {result.success ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-emerald-700 font-semibold">✓ Update logged</span>
                  <span className="badge bg-emerald-100 text-emerald-700 border-emerald-200">{result.leads_created} new</span>
                  <span className="badge bg-blue-100 text-blue-700 border-blue-200">{result.leads_updated} updated</span>
                </div>
                {result.summary && <div className="p-3 bg-white/60 rounded-xl border border-emerald-100 mb-3 text-sm text-slate-700"><span className="font-semibold text-emerald-700">Summary: </span>{result.summary}</div>}
                <div className="space-y-2">
                  {result.results?.map((r: any) => (
                    <Link key={r.lead_id} href={`/leads/${r.lead_id}`} className="flex items-center gap-3 p-3 bg-white/60 rounded-xl border border-emerald-100 hover:bg-white transition-colors group">
                      <span className={`badge ${r.is_new ? 'bg-brand-50 text-brand-700 border-brand-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{r.is_new ? '+ New' : '↻ Updated'}</span>
                      <span className="text-sm font-semibold text-slate-700 group-hover:text-brand-600">{r.company_name}</span>
                      <span className="ml-auto text-xs text-slate-400">View →</span>
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-rose-700 text-sm"><strong>Error:</strong> {result.error}</div>
            )}
          </div>
        )}

        <form onSubmit={handleParse} className="space-y-5">
          <div className="card p-6 space-y-5">
            <div>
              <label className="label">Your Update</label>
              <textarea className="input font-mono text-xs leading-relaxed resize-none" rows={14}
                placeholder={"Write what happened today / on the date you select...\n\nExample:\n- Met with Acme Corp, John is interested in our premium line. Wants a proposal by Friday.\n- Called TechStart, spoke with Sarah. She needs budget approval. Follow up next week.\n- New lead: Global Trade Ltd, met Mike at trade show. Very promising early stage."}
                value={emailText} onChange={e=>setEmailText(e.target.value)} required/>
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input max-w-xs" value={emailDate} onChange={e=>setEmailDate(e.target.value)}/>
              <p className="text-xs text-slate-400 mt-1">Leads & updates from this submission will be timestamped to this date.</p>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full justify-center py-3 text-base" disabled={loading||!emailText.trim()}>
            {loading ? (<><svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Analysing with AI…</>) : (<><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>Submit Update</>)}
          </button>
        </form>

        <div className="mt-8 card p-5 bg-slate-50">
          <div className="grid grid-cols-3 gap-4 text-center">
            {[{i:'📧',t:'Type your update',d:'Plain text — same as if writing an email'},{i:'🤖',t:'AI extracts',d:'Each lead and what happened gets logged'},{i:'📊',t:'Auto-routes',d:'New leads added, existing ones updated'}].map(s=>(
              <div key={s.t} className="p-3">
                <div className="text-2xl mb-2">{s.i}</div>
                <div className="text-xs font-semibold text-slate-700 mb-1">{s.t}</div>
                <div className="text-xs text-slate-400">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
