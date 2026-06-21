'use client';
import { Suspense } from 'react';
import AppShell from '@/components/AppShell';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function EmailsInner() {
  const params = useSearchParams();
  const leadId = params.get('lead');

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="page-title">Email</h1>
        <p className="page-sub">Your inbox, connected to your leads — with Claude helping you write and reply.</p>
      </div>

      {leadId && (
        <Link href={`/leads/${leadId}`} className="text-sm text-slate-400 hover:text-brand-600 inline-flex items-center gap-1 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          Back to lead
        </Link>
      )}

      <div className="card p-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Email is being set up</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          {leadId ? "This lead's email thread will appear here once your mailbox is connected." : 'The mailbox — thread list, conversation view, and compose with Claude — is coming next.'}
          {' '}Connecting a real mailbox needs a provider + credentials; an admin can set that up.
        </p>
      </div>
    </div>
  );
}

export default function EmailsPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="p-8"><div className="card p-10 h-40 animate-pulse bg-slate-100" /></div>}>
        <EmailsInner />
      </Suspense>
    </AppShell>
  );
}
