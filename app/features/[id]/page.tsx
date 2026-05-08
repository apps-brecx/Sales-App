'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { formatDateTime, timeAgo } from '@/lib/utils';

const STATUSES = [
  { value: 'open',        label: 'Open',        bg: 'bg-slate-50',   color: 'text-slate-700',   border: 'border-slate-200' },
  { value: 'in_progress', label: 'In progress', bg: 'bg-brand-50',   color: 'text-brand-700',   border: 'border-brand-200' },
  { value: 'done',        label: 'Done',        bg: 'bg-emerald-50', color: 'text-emerald-700', border: 'border-emerald-200' },
  { value: 'declined',    label: 'Declined',    bg: 'bg-rose-50',    color: 'text-rose-700',    border: 'border-rose-200' },
];

export default function FeatureDetailPage() {
  const params = useParams();
  const id = params?.id;
  const { data: session } = useSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [posting, setPosting] = useState(false);

  const role = (session?.user as any)?.role;
  const isStaff = role === 'admin' || role === 'manager';

  function load() {
    if (!id) return;
    fetch(`/api/features/${id}`).then(async r => {
      if (!r.ok) { setError((await r.json()).error || 'Failed to load'); setLoading(false); return; }
      setData(await r.json()); setLoading(false);
    }).catch(() => { setError('Failed to load'); setLoading(false); });
  }
  useEffect(load, [id]);

  async function postReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setPosting(true);
    const res = await fetch(`/api/features/${id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: reply }) });
    setPosting(false);
    if (res.ok) { setReply(''); load(); }
  }

  async function changeStatus(status: string) {
    const res = await fetch(`/api/features/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (res.ok) load();
  }

  const currentStatus = STATUSES.find(s => s.value === data?.status) || STATUSES[0];

  return (
    <AppShell>
      <div className="p-8 max-w-3xl mx-auto">
        <Link href="/features" className="text-sm text-slate-400 hover:text-brand-600 transition-colors flex items-center gap-1 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          Back to Feature Requests
        </Link>

        {loading ? (
          <div className="card p-8 animate-pulse h-48 bg-slate-100"/>
        ) : error ? (
          <div className="card p-8 text-rose-700 bg-rose-50 border-rose-200">{error}</div>
        ) : data && (
          <>
            <div className="card p-6 mb-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h1 className="text-xl font-bold text-slate-900 flex-1">{data.title}</h1>
                {isStaff ? (
                  <select
                    className={`badge ${currentStatus.bg} ${currentStatus.color} ${currentStatus.border} cursor-pointer outline-none`}
                    value={data.status}
                    onChange={e => changeStatus(e.target.value)}
                  >
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                ) : (
                  <span className={`badge ${currentStatus.bg} ${currentStatus.color} ${currentStatus.border}`}>{currentStatus.label}</span>
                )}
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{data.description}</p>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-3 text-xs text-slate-400">
                <span>Submitted by <span className="font-medium text-slate-600">{data.user_name}</span></span>
                <span>·</span>
                <span>{formatDateTime(data.created_at)}</span>
              </div>
            </div>

            <div className="card p-6">
              <h2 className="font-semibold text-slate-800 mb-4">Discussion {data.comments?.length > 0 && <span className="text-sm font-normal text-slate-400">({data.comments.length})</span>}</h2>

              {(!data.comments || data.comments.length === 0) && (
                <p className="text-sm text-slate-400 text-center py-4 mb-4">No replies yet — start the conversation</p>
              )}

              {data.comments?.length > 0 && (
                <div className="space-y-4 mb-5">
                  {data.comments.map((c: any) => (
                    <div key={c.id} className="flex gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                        c.user_role === 'admin' || c.user_role === 'manager' ? 'bg-rose-100 text-rose-700' : 'bg-brand-100 text-brand-700'
                      }`}>{c.user_name?.[0]?.toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-sm font-semibold text-slate-800">{c.user_name}</span>
                          {(c.user_role === 'admin' || c.user_role === 'manager') && <span className="text-[10px] uppercase text-rose-600 font-bold">Admin</span>}
                          <span className="text-xs text-slate-400">{timeAgo(c.created_at)}</span>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{c.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={postReply} className="flex gap-2 pt-4 border-t border-slate-100">
                <input
                  className="input flex-1"
                  placeholder="Write a reply…"
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  required
                />
                <button type="submit" className="btn-primary" disabled={posting || !reply.trim()}>{posting ? 'Posting…' : 'Reply'}</button>
              </form>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
