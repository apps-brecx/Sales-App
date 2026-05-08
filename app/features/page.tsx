'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { timeAgo } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  open:        { label: 'Open',        bg: 'bg-slate-50',   color: 'text-slate-700',   border: 'border-slate-200' },
  in_progress: { label: 'In progress', bg: 'bg-brand-50',   color: 'text-brand-700',   border: 'border-brand-200' },
  done:        { label: 'Done',        bg: 'bg-emerald-50', color: 'text-emerald-700', border: 'border-emerald-200' },
  declined:    { label: 'Declined',    bg: 'bg-rose-50',    color: 'text-rose-700',    border: 'border-rose-200' },
};

export default function FeaturesPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const role = (session?.user as any)?.role;
  const isStaff = role === 'admin' || role === 'manager';

  function load() {
    fetch('/api/features').then(r => r.json()).then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return setError('Title and description are required');
    setSubmitting(true); setError('');
    const res = await fetch('/api/features', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, description }) });
    setSubmitting(false);
    if (res.ok) { setTitle(''); setDescription(''); setShowForm(false); load(); }
    else { const d = await res.json(); setError(d.error || 'Failed'); }
  }

  return (
    <AppShell>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="page-title">Feature Requests</h1>
            <p className="page-sub">{isStaff ? 'Requests from your team — reply, update status.' : 'Suggest features you want on the app.'}</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            New request
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="card p-6 mb-6 space-y-4 animate-fade-in">
            {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">{error}</div>}
            <div>
              <label className="label">Title</label>
              <input className="input" placeholder="Short summary of what you want" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} required />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input resize-none" rows={5} placeholder="Describe the feature in detail — why it matters, how it should work, any examples." value={description} onChange={e => setDescription(e.target.value)} required />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit request'}</button>
              <button type="button" onClick={() => { setShowForm(false); setError(''); }} className="btn-secondary">Cancel</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="space-y-3">{[...Array(3)].map((_,i)=><div key={i} className="card p-5 animate-pulse h-24 bg-slate-100"/>)}</div>
        ) : items.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-slate-400 mb-2">No feature requests yet</p>
            {!showForm && <button onClick={() => setShowForm(true)} className="text-brand-600 text-sm hover:underline">Be the first to suggest one →</button>}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((f: any) => {
              const cfg = STATUS_CONFIG[f.status] || STATUS_CONFIG.open;
              return (
                <Link key={f.id} href={`/features/${f.id}`} className="card p-5 hover:border-brand-300 transition-all block group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-slate-800 group-hover:text-brand-600">{f.title}</h3>
                        <span className={`badge ${cfg.bg} ${cfg.color} ${cfg.border}`}>{cfg.label}</span>
                      </div>
                      <p className="text-sm text-slate-500 line-clamp-2 mb-2">{f.description}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>by <span className="font-medium text-slate-600">{f.user_name}</span></span>
                        <span>·</span>
                        <span>{timeAgo(f.updated_at)}</span>
                        {Number(f.comment_count) > 0 && <>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                            {f.comment_count}
                          </span>
                        </>}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
