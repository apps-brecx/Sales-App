'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { formatDate, timeAgo } from '@/lib/utils';

export default function SubmissionsPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const role = (session?.user as any)?.role;
  const isStaff = role === 'admin' || role === 'manager';

  useEffect(() => {
    fetch('/api/submissions').then(r => r.json()).then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="page-title">Submissions</h1>
          <p className="page-sub">{isStaff ? "Every email parsed by anyone — click into one to see what was written and which leads it touched." : "Emails you submitted plus any the admin parsed for you."}</p>
        </div>

        {loading ? (
          <div className="space-y-3">{[...Array(4)].map((_,i)=><div key={i} className="card p-5 animate-pulse h-24 bg-slate-100"/>)}</div>
        ) : items.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-slate-400 mb-3">No submissions yet</p>
            {!isStaff && <Link href="/my/update" className="btn-primary inline-flex">Submit your first update</Link>}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((s: any) => (
              <Link key={s.id} href={`/submissions/${s.id}`} className="card p-5 hover:border-brand-300 transition-all block group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-slate-500">{s.email_date ? formatDate(s.email_date) : formatDate(s.created_at)}</span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-slate-400">submitted by <span className="font-medium text-slate-600">{s.user_name}</span></span>
                      {s.assigned_name && s.assigned_name !== s.user_name && <>
                        <span className="text-xs text-slate-300">→</span>
                        <span className="text-xs text-slate-400">for <span className="font-medium text-slate-600">{s.assigned_name}</span></span>
                      </>}
                    </div>
                    <p className="text-sm text-slate-700 line-clamp-2 mb-3 group-hover:text-brand-700">
                      {s.summary || s.email_text?.slice(0, 200) + (s.email_text?.length > 200 ? '…' : '')}
                    </p>
                    <div className="flex gap-2">
                      {s.leads_created > 0 && <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200">+{s.leads_created} new</span>}
                      {s.leads_updated > 0 && <span className="badge bg-amber-50 text-amber-700 border-amber-200">↻ {s.leads_updated} updated</span>}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 shrink-0">{timeAgo(s.created_at)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
