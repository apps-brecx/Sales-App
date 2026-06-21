'use client';
import { Suspense, useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import EmailAccountModal from '@/components/EmailAccountModal';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { timeAgo } from '@/lib/utils';

function EmailsInner() {
  const params = useSearchParams();
  const leadId = params.get('lead');
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  function load() {
    fetch('/api/email-account').then(r => r.json()).then(d => { setAccount(d); setLoading(false); }).catch(() => setLoading(false));
  }
  useEffect(load, []);

  const configured = account?.configured;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Email</h1>
          <p className="page-sub">Your inbox, connected to your leads — with Claude helping you write and reply.</p>
        </div>
        {configured && <button onClick={() => setModal(true)} className="btn-secondary shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          Email settings
        </button>}
      </div>

      {leadId && (
        <Link href={`/leads/${leadId}`} className="text-sm text-slate-400 hover:text-brand-600 inline-flex items-center gap-1 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          Back to lead
        </Link>
      )}

      {loading ? (
        <div className="card p-10 h-40 animate-pulse bg-slate-100" />
      ) : !configured ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Connect your email</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-5">Link your Gmail mailbox (IMAP to receive, SMTP to send). You'll need a Gmail <b>App Password</b>. Once connected, your conversations show up here next to your leads.</p>
          <button onClick={() => setModal(true)} className="btn-primary inline-flex">Add email account</button>
        </div>
      ) : (
        <>
          <div className="card p-5 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
                {(account.email_address || '?')[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 truncate">{account.email_address}</div>
                <div className="text-xs text-slate-400">IMAP {account.imap_host}:{account.imap_port} · SMTP {account.smtp_host || account.imap_host}:{account.smtp_port}</div>
              </div>
              <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200">Connected</span>
            </div>
            <div className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">
              {account.last_synced_at ? `Last synced ${timeAgo(account.last_synced_at)}` : 'Not synced yet'}
            </div>
          </div>

          <div className="card p-8 text-center">
            <h3 className="font-semibold text-slate-800 mb-1">Mailbox coming next</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">Your account is connected and ready. The inbox, conversation view, and compose (with Claude) land in the next update — then this page fills with your threads.</p>
          </div>
        </>
      )}

      {modal && <EmailAccountModal initial={account} onClose={() => setModal(false)} onSaved={() => { setModal(false); setLoading(true); load(); }} />}
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
