'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import Link from 'next/link';
import StageBadge from '@/components/StageBadge';
import { formatDate, formatDateTime } from '@/lib/utils';
import { LeadStage } from '@/types';

export default function SubmissionDetailPage() {
  const params = useParams();
  const id = params?.id;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetch(`/api/submissions/${id}`).then(async r => {
      if (!r.ok) { setError((await r.json()).error || 'Failed to load'); setLoading(false); return; }
      const d = await r.json();
      setData(d);
      setLoading(false);
    }).catch(() => { setError('Failed to load'); setLoading(false); });
  }, [id]);

  return (
    <AppShell>
      <div className="p-8 max-w-3xl mx-auto">
        <Link href="/submissions" className="text-sm text-slate-400 hover:text-brand-600 transition-colors flex items-center gap-1 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          Back to Submissions
        </Link>

        {loading ? (
          <div className="card p-8 animate-pulse h-48 bg-slate-100"/>
        ) : error ? (
          <div className="card p-8 text-rose-700 bg-rose-50 border-rose-200">{error}</div>
        ) : data && (
          <>
            <div className="mb-6">
              <h1 className="page-title">Submission</h1>
              <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                <span>{data.email_date ? formatDate(data.email_date) : formatDateTime(data.created_at)}</span>
                <span className="text-slate-300">·</span>
                <span>by <span className="font-semibold text-slate-700">{data.user_name}</span></span>
                {data.assigned_name && data.assigned_name !== data.user_name && (
                  <>
                    <span className="text-slate-300">→</span>
                    <span>for <span className="font-semibold text-slate-700">{data.assigned_name}</span></span>
                  </>
                )}
              </div>
            </div>

            {data.summary && (
              <div className="card p-5 mb-5 bg-brand-50/50 border-brand-100">
                <div className="text-xs font-semibold text-brand-700 uppercase mb-2">AI Summary</div>
                <p className="text-sm text-slate-700">{data.summary}</p>
              </div>
            )}

            <div className="card p-6 mb-5">
              <div className="text-xs font-semibold text-slate-500 uppercase mb-3">What was submitted</div>
              <pre className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap font-mono bg-slate-50 p-4 rounded-xl border border-slate-100">{data.email_text}</pre>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-800">Leads from this submission</h2>
                <div className="flex gap-2">
                  {data.leads_created > 0 && <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200">+{data.leads_created} new</span>}
                  {data.leads_updated > 0 && <span className="badge bg-amber-50 text-amber-700 border-amber-200">↻ {data.leads_updated} updated</span>}
                </div>
              </div>
              {(!data.updates || data.updates.length === 0) ? (
                <p className="text-sm text-slate-400 text-center py-6">No leads recorded for this submission</p>
              ) : (
                <div className="space-y-2">
                  {data.updates.map((u: any) => (
                    <Link key={u.id} href={`/leads/${u.lead_id}`} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:border-brand-300 transition-all group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-slate-700 group-hover:text-brand-600">{u.company_name}</span>
                          <StageBadge stage={u.lead_stage as LeadStage} />
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">{u.content}</p>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">View →</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
