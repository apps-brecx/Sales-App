'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ALL_STAGES, STAGE_CONFIG } from '@/lib/utils';

export default function QuickLog() {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [leadId, setLeadId] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [stageTo, setStageTo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open && leads.length === 0) {
      fetch('/api/leads').then(r => r.json()).then(d => setLeads(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }, [open, leads.length]);

  function reset() {
    setLeadId(null); setContent(''); setStageTo(''); setSearch(''); setSuccess(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!leadId || !content.trim()) return;
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    setSubmitting(true);
    const res = await fetch('/api/updates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: leadId,
        content: content.trim(),
        stage_from: lead.stage,
        stage_to: stageTo || lead.stage,
        source: 'manual',
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      setSuccess(true);
      setTimeout(() => { reset(); setOpen(false); }, 800);
    }
  }

  if (status !== 'authenticated') return null;

  const filtered = search
    ? leads.filter(l => l.company_name?.toLowerCase().includes(search.toLowerCase()))
    : leads.slice(0, 50);
  const selectedLead = leadId ? leads.find(l => l.id === leadId) : null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-30 group"
        title="Quick log update"
      >
        <svg className="w-6 h-6 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 flex items-center justify-center p-4 animate-fade-in" onClick={() => { reset(); setOpen(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">Quick log update</h2>
              <button onClick={() => { reset(); setOpen(false); }} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {success ? (
              <div className="py-8 text-center">
                <div className="w-12 h-12 bg-emerald-100 rounded-full mx-auto flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                </div>
                <p className="text-sm text-slate-600">Update logged</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {!selectedLead ? (
                  <div>
                    <label className="label">Pick a lead</label>
                    <input
                      className="input mb-2"
                      placeholder="Search company name…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      autoFocus
                    />
                    <div className="max-h-52 overflow-y-auto border border-slate-100 rounded-xl">
                      {filtered.length === 0 && <div className="p-4 text-sm text-slate-400 text-center">No matches</div>}
                      {filtered.map(l => (
                        <button
                          type="button"
                          key={l.id}
                          onClick={() => { setLeadId(l.id); setSearch(''); }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center justify-between gap-2"
                        >
                          <span className="text-sm font-medium text-slate-700 truncate">{l.company_name}</span>
                          <span className="text-xs text-slate-400 shrink-0">{STAGE_CONFIG[l.stage as keyof typeof STAGE_CONFIG]?.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 p-3 bg-brand-50 border border-brand-100 rounded-xl">
                      <span className="text-sm font-semibold text-brand-700 flex-1 truncate">{selectedLead.company_name}</span>
                      <button type="button" onClick={() => setLeadId(null)} className="text-xs text-brand-600 hover:underline">Change</button>
                    </div>
                    <div>
                      <label className="label">What happened?</label>
                      <textarea
                        className="input resize-none"
                        rows={4}
                        placeholder="Brief note about the call, meeting, email, or progress…"
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        autoFocus
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Move to stage (optional)</label>
                      <select className="input" value={stageTo} onChange={e => setStageTo(e.target.value)}>
                        <option value="">Keep current — {STAGE_CONFIG[selectedLead.stage as keyof typeof STAGE_CONFIG]?.label}</option>
                        {ALL_STAGES.map(s => <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button type="submit" className="btn-primary flex-1 justify-center" disabled={submitting || !content.trim()}>
                        {submitting ? 'Saving…' : 'Log update'}
                      </button>
                      <button type="button" onClick={() => { reset(); setOpen(false); }} className="btn-secondary">Cancel</button>
                    </div>
                  </>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
