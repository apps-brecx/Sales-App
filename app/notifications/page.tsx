'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import Link from 'next/link';
import StageBadge from '@/components/StageBadge';
import { LeadStage } from '@/types';
import { formatDateTime, timeAgo } from '@/lib/utils';

export default function NotificationsPage() {
  const [list, setList] = useState<any[]>([]);
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/notifications').then(r => r.json()).then(d => {
      const arr = Array.isArray(d.list) ? d.list : [];
      setList(arr);
      setSeenAt(arr[0]?.seen_at || null);
      setLoading(false);
      // Mark as read on visit
      fetch('/api/notifications', { method: 'POST' }).catch(() => {});
    }).catch(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="page-title">Notifications</h1>
          <p className="page-sub">Every update logged by your team — newest first.</p>
        </div>

        {loading ? (
          <div className="space-y-3">{[...Array(5)].map((_,i)=><div key={i} className="card p-4 animate-pulse h-20 bg-slate-100"/>)}</div>
        ) : list.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-slate-400">No team activity yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((n: any) => {
              const isUnread = seenAt && new Date(n.created_at) > new Date(seenAt);
              return (
                <div key={n.id} className={`card p-4 ${isUnread ? 'border-brand-300 bg-brand-50/30' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                      n.user_role === 'salesman' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {n.user_name?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800">{n.user_name}</span>
                        <span className="text-xs text-slate-400">logged an update on</span>
                        <Link href={`/leads/${n.lead_id}`} className="text-sm font-semibold text-brand-600 hover:underline">{n.company_name}</Link>
                        <StageBadge stage={n.stage as LeadStage}/>
                        {n.source === 'email' && <span className="badge bg-brand-50 text-brand-600 border-brand-200">📧 email</span>}
                        {isUnread && <span className="badge bg-rose-100 text-rose-700 border-rose-200 font-bold">NEW</span>}
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-3 mb-1">{n.content}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>{timeAgo(n.created_at)}</span>
                        <span>·</span>
                        <span>{formatDateTime(n.created_at)}</span>
                        {n.email_submission_id && (
                          <>
                            <span>·</span>
                            <Link href={`/submissions/${n.email_submission_id}`} className="text-brand-600 hover:underline">View submission</Link>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
