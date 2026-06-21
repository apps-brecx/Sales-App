'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import AppShell from '@/components/AppShell';
import EmailAccountModal from '@/components/EmailAccountModal';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { timeAgo, cn } from '@/lib/utils';

type Thread = {
  id: number; thread_key: string; lead_id: number | null; lead_name: string | null;
  counterpart_name: string | null; counterpart_email: string | null; subject: string | null;
  last_message_at: string | null; last_snippet: string | null; unread: number; starred: number; archived: number;
  autopilot: number; auto_mode: string; draft_text: string | null;
};
type Message = { id: number; direction: string; from_name: string | null; from_addr: string | null; body_text: string | null; subject: string | null; sent_at: string };

const TABS = [['inbox', 'Inbox'], ['starred', 'Starred'], ['archived', 'Archived']] as const;
const TONES = ['Friendly', 'Professional', 'Persuasive'];

function EmailsInner() {
  const params = useSearchParams();
  const leadId = params.get('lead');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('inbox');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'table'>('list');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [thread, setThread] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [acctModal, setAcctModal] = useState(false);
  const [compose, setCompose] = useState<null | { to: string; subject: string; body: string; thread_id?: number }>(null);
  const didLead = useRef(false);

  function load(t = tab, s = search) {
    return fetch(`/api/emails?tab=${t}&search=${encodeURIComponent(s)}`).then(r => r.json()).then(d => { setData(d); setLoading(false); return d; }).catch(() => setLoading(false));
  }
  async function sync() {
    if (syncing) return;
    setSyncing(true);
    await fetch('/api/emails/sync', { method: 'POST' }).catch(() => {});
    setSyncing(false);
    await load();
    if (activeId) openThread(activeId, true);
  }
  function openThread(id: number, quiet = false) {
    if (!quiet) setActiveId(id);
    fetch(`/api/emails?id=${id}`).then(r => r.json()).then(d => { setThread(d.thread); if (!quiet) load(); }).catch(() => {});
  }

  useEffect(() => { load().then(() => sync()); /* eslint-disable-next-line */ }, []);
  useEffect(() => { load(tab, search); /* eslint-disable-next-line */ }, [tab]);

  // If arriving from a lead, prefill search + compose recipient.
  useEffect(() => {
    if (leadId && !didLead.current) {
      didLead.current = true;
      fetch(`/api/leads/${leadId}`).then(r => r.json()).then(l => {
        if (l?.contact_email) { setSearch(l.contact_email); load(tab, l.contact_email); }
      }).catch(() => {});
    }
  }, [leadId]); // eslint-disable-line

  async function flag(thread_id: number, patch: any) {
    await fetch('/api/emails/flags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ thread_id, ...patch }) });
    load(); if (activeId === thread_id) openThread(thread_id, true);
  }
  async function setMaster(on: boolean) {
    await fetch('/api/emails/flags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account: { autopilot_master: on } }) });
    load();
  }

  if (loading) return <div className="p-8"><div className="card p-10 h-60 animate-pulse bg-slate-100" /></div>;

  if (!data?.configured) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="mb-6"><h1 className="page-title">Email</h1><p className="page-sub">Your inbox, connected to your leads.</p></div>
        {leadId && <Link href={`/leads/${leadId}`} className="text-sm text-slate-400 hover:text-brand-600 inline-flex items-center gap-1 mb-4"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>Back to lead</Link>}
        <div className="card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4"><svg className="w-7 h-7 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg></div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Connect your email</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-5">Link your Gmail mailbox (IMAP + SMTP). You'll need a Gmail <b>App Password</b>.</p>
          <button onClick={() => setAcctModal(true)} className="btn-primary inline-flex">Add email account</button>
        </div>
        {acctModal && <EmailAccountModal initial={null} onClose={() => setAcctModal(false)} onSaved={() => { setAcctModal(false); load(); }} />}
      </div>
    );
  }

  const threads: Thread[] = Array.isArray(data.threads) ? data.threads : [];

  return (
    <div className="p-6 lg:p-8 flex flex-col h-[calc(100vh-0px)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Email</h1>
          <p className="text-sm text-slate-500 mt-0.5">Connected to {data.email_address} · {data.last_synced_at ? `synced ${timeAgo(data.last_synced_at)}` : 'not synced yet'}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setMaster(!data.autopilot_master)} className={cn('flex items-center gap-2 pl-2.5 pr-3 py-2 rounded-xl border text-sm font-semibold', data.autopilot_master ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-500')}>
            <span className={cn('relative inline-flex h-5 w-9 rounded-full transition-colors', data.autopilot_master ? 'bg-brand-600' : 'bg-slate-300')}><span className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform" style={{ transform: data.autopilot_master ? 'translateX(16px)' : 'translateX(0)' }} /></span>
            AI Autopilot
          </button>
          <button onClick={sync} className="btn-secondary" disabled={syncing}><svg className={cn('w-4 h-4', syncing && 'animate-spin')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>{syncing ? 'Syncing…' : 'Sync'}</button>
          <button onClick={() => setCompose({ to: '', subject: '', body: '' })} className="btn-primary"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.83a4 4 0 01-1.897 1.013l-2.796.699.699-2.796A4 4 0 019 13z"/></svg>Compose</button>
          <button onClick={() => setAcctModal(true)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100" title="Email settings"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg></button>
        </div>
      </div>

      {/* Tabs + search + view toggle */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={cn('px-3.5 py-1.5 rounded-lg text-xs font-semibold', tab === k ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}>{label}{k === 'inbox' && data.unread > 0 && <span className="ml-1 text-brand-600">{data.unread}</span>}</button>
          ))}
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input className="w-56 pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand-400" placeholder="Search email…" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') load(tab, search); }} />
        </div>
        <div className="ml-auto flex gap-1 bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setView('list')} className={cn('p-1.5 rounded-lg', view === 'list' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400')} title="List view"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg></button>
          <button onClick={() => setView('table')} className={cn('p-1.5 rounded-lg', view === 'table' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400')} title="Table view"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 6h18M3 18h18"/></svg></button>
        </div>
      </div>

      {/* Split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0">
        <div className={cn('card overflow-hidden flex flex-col', view === 'table' ? 'lg:col-span-12' : 'lg:col-span-4', activeId && view === 'list' ? 'hidden lg:flex' : '')}>
          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-10 text-slate-400">
                <svg className="w-10 h-10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                <div className="text-sm font-medium text-slate-500">{syncing ? 'Syncing your inbox…' : 'Nothing here yet'}</div>
                {!syncing && <div className="text-xs mt-1">Hit Sync to pull your latest email.</div>}
              </div>
            ) : view === 'table' ? (
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-400 border-b border-slate-100"><tr><th className="text-left font-medium px-4 py-2">From</th><th className="text-left font-medium px-4 py-2">Subject</th><th className="text-left font-medium px-4 py-2">Lead</th><th className="text-right font-medium px-4 py-2">When</th></tr></thead>
                <tbody>
                  {threads.map(t => (
                    <tr key={t.id} onClick={() => openThread(t.id)} className={cn('cursor-pointer border-b border-slate-50 hover:bg-slate-50', t.unread && 'font-semibold', activeId === t.id && 'bg-brand-50')}>
                      <td className="px-4 py-2.5 whitespace-nowrap">{t.counterpart_name || t.counterpart_email}</td>
                      <td className="px-4 py-2.5"><span className="text-slate-700">{t.subject || '(no subject)'}</span> <span className="text-slate-400 font-normal">— {t.last_snippet}</span></td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{t.lead_name ? <Link href={`/leads/${t.lead_id}`} className="text-brand-600 hover:underline">{t.lead_name}</Link> : <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-slate-400 whitespace-nowrap">{t.last_message_at ? timeAgo(t.last_message_at) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="divide-y divide-slate-50">
                {threads.map(t => (
                  <div key={t.id} onClick={() => openThread(t.id)} className={cn('p-4 cursor-pointer hover:bg-slate-50 group', activeId === t.id && 'bg-brand-50', t.unread && 'bg-brand-50/40')}>
                    <div className="flex items-start gap-3">
                      <button onClick={e => { e.stopPropagation(); flag(t.id, { starred: !t.starred }); }} className={cn('mt-0.5 shrink-0', t.starred ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300')}><svg className="w-4 h-4" fill={t.starred ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.05 9.797c-.783-.57-.38-1.81.588-1.81h4.915a1 1 0 00.95-.69l1.519-4.674z"/></svg></button>
                      <div className="w-9 h-9 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">{(t.counterpart_name || t.counterpart_email || '?')[0]?.toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {!!t.unread && <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />}
                          <span className="text-sm font-semibold text-slate-800 truncate">{t.counterpart_name || t.counterpart_email}</span>
                          <span className="ml-auto text-[11px] text-slate-400 shrink-0">{t.last_message_at ? timeAgo(t.last_message_at) : ''}</span>
                        </div>
                        <div className="text-sm font-medium text-slate-700 truncate mt-0.5">{t.subject || '(no subject)'}</div>
                        <div className="text-xs text-slate-400 line-clamp-1 mt-0.5">{t.last_snippet}</div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {t.lead_name && <Link onClick={e => e.stopPropagation()} href={`/leads/${t.lead_id}`} className="inline-flex items-center gap-1 text-[10px] font-medium text-brand-600 bg-brand-50 border border-brand-200 rounded-full px-1.5 py-0.5">🔗 {t.lead_name}</Link>}
                          {!!t.autopilot && data.autopilot_master && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-600 bg-violet-50 border border-violet-200 rounded-full px-1.5 py-0.5">✨ Autopilot</span>}
                          {t.draft_text && <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">Draft ready</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Reader */}
        {view === 'list' && (
          <div className={cn('card overflow-hidden flex-col lg:col-span-8', activeId ? 'flex' : 'hidden lg:flex')}>
            {!thread ? (
              <div className="flex-1 flex items-center justify-center text-sm text-slate-400">Select a conversation</div>
            ) : (
              <Reader thread={thread} masterOn={data.autopilot_master} onFlag={flag} onReply={() => setCompose({ to: thread.counterpart_email, subject: thread.subject?.startsWith('Re:') ? thread.subject : `Re: ${thread.subject || ''}`.trim(), body: '', thread_id: thread.id })} onBack={() => { setActiveId(null); setThread(null); }} onSent={() => { openThread(thread.id, true); load(); }} />
            )}
          </div>
        )}
      </div>

      {compose && <Compose initial={compose} onClose={() => setCompose(null)} onSent={() => { setCompose(null); load(); if (activeId) openThread(activeId, true); }} />}
      {acctModal && <EmailAccountModal initial={{ ...data, configured: true }} onClose={() => setAcctModal(false)} onSaved={() => { setAcctModal(false); load(); }} />}
    </div>
  );
}

function Reader({ thread, masterOn, onFlag, onReply, onBack, onSent }: any) {
  const [reply, setReply] = useState('');
  const [tone, setTone] = useState('Friendly');
  const [busy, setBusy] = useState('');
  const messages: Message[] = thread.messages || [];

  async function ai(action: string) {
    setBusy(action);
    const res = await fetch('/api/emails/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, tone, text: reply, thread_id: thread.id }) });
    const d = await res.json(); setBusy('');
    if (d.text) setReply(d.text); else if (d.error) alert(d.error);
  }
  async function send() {
    if (!reply.trim()) return;
    setBusy('send');
    const res = await fetch('/api/emails/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ thread_id: thread.id, body: reply }) });
    const d = await res.json(); setBusy('');
    if (d.ok) { setReply(''); onSent(); } else alert(d.error || 'Send failed');
  }

  return (
    <>
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <button onClick={onBack} className="lg:hidden text-slate-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg></button>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800 truncate">{thread.subject || '(no subject)'}</div>
          <div className="text-xs text-slate-400 truncate">{thread.counterpart_name} · {thread.counterpart_email}{thread.lead_name && <> · <Link href={`/leads/${thread.lead_id}`} className="text-brand-600 hover:underline">{thread.lead_name}</Link></>}</div>
        </div>
        <button onClick={() => onFlag(thread.id, { starred: !thread.starred })} className={cn(thread.starred ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300')} title="Star"><svg className="w-5 h-5" fill={thread.starred ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.05 9.797c-.783-.57-.38-1.81.588-1.81h4.915a1 1 0 00.95-.69l1.519-4.674z"/></svg></button>
        <button onClick={() => onFlag(thread.id, { archived: !thread.archived })} className="text-slate-300 hover:text-slate-600" title="Archive"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg></button>
      </div>

      {/* Autopilot control */}
      <div className={cn('mx-5 mt-4 rounded-xl border p-3 flex items-center gap-3', thread.autopilot && masterOn ? 'border-brand-200 bg-brand-50/50' : 'border-slate-200 bg-white')}>
        <svg className={cn('w-5 h-5 shrink-0', thread.autopilot && masterOn ? 'text-brand-600' : 'text-slate-400')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        <div className="flex-1 min-w-0 text-xs">
          {!masterOn ? <span className="text-slate-500">Turn on AI Autopilot (top right) to let Claude run leads.</span>
            : thread.autopilot ? <span className="text-slate-700 font-medium">Autopilot is running this lead · {thread.auto_mode === 'send' ? 'auto-sends replies' : 'drafts for your review'}</span>
            : <span className="text-slate-500">You're handling this lead.</span>}
        </div>
        {masterOn && (thread.autopilot ? (
          <div className="flex items-center gap-1.5">
            <select value={thread.auto_mode} onChange={e => onFlag(thread.id, { auto_mode: e.target.value })} className="text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none">
              <option value="review">Review</option><option value="send">Auto-send</option>
            </select>
            <button onClick={() => onFlag(thread.id, { autopilot: false })} className="text-xs font-semibold px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700">Take over</button>
          </div>
        ) : <button onClick={() => onFlag(thread.id, { autopilot: true })} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-600 text-white shrink-0">Hand to Autopilot</button>)}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={cn('flex', m.direction === 'out' ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap', m.direction === 'out' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700')}>
              <div className={cn('text-[11px] mb-1', m.direction === 'out' ? 'text-brand-100' : 'text-slate-400')}>{m.direction === 'out' ? 'You' : (m.from_name || m.from_addr)} · {timeAgo(m.sent_at)}</div>
              {m.body_text}
            </div>
          </div>
        ))}
        {thread.draft_text && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
            <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-1.5">Autopilot draft — your OK needed</div>
            <div className="text-sm text-slate-700 whitespace-pre-wrap">{thread.draft_text}</div>
            <div className="flex gap-2 mt-2.5">
              <button onClick={async () => { await fetch('/api/emails/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ thread_id: thread.id, body: thread.draft_text }) }); onSent(); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 text-white">Approve &amp; send</button>
              <button onClick={() => { setReply(thread.draft_text); onFlag(thread.id, { draft_text: '' }); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700">Edit</button>
            </div>
          </div>
        )}
      </div>

      {/* Reply box */}
      <div className="border-t border-slate-100 p-4">
        <textarea className="input min-h-[90px] mb-2" placeholder="Write a reply…" value={reply} onChange={e => setReply(e.target.value)} />
        <div className="flex items-center gap-2 flex-wrap">
          <select value={tone} onChange={e => setTone(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none">{TONES.map(t => <option key={t}>{t}</option>)}</select>
          <button onClick={() => ai(reply.trim() ? 'improve' : 'reply')} className="text-xs font-semibold text-brand-600 border border-brand-200 bg-brand-50 rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1" disabled={!!busy}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
            {busy === 'reply' || busy === 'improve' ? 'Writing…' : reply.trim() ? 'Improve' : 'Draft with Claude'}
          </button>
          {reply.trim() && <button onClick={() => ai('shorten')} className="text-xs font-medium text-slate-500 border border-slate-200 rounded-lg px-2.5 py-1.5" disabled={!!busy}>Shorten</button>}
          <button onClick={send} className="btn-primary ml-auto" disabled={!reply.trim() || !!busy}>{busy === 'send' ? 'Sending…' : 'Send'}</button>
        </div>
      </div>
    </>
  );
}

function Compose({ initial, onClose, onSent }: { initial: { to: string; subject: string; body: string; thread_id?: number }; onClose: () => void; onSent: () => void }) {
  const [to, setTo] = useState(initial.to);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [tone, setTone] = useState('Friendly');
  const [busy, setBusy] = useState('');

  async function ai(action: string) {
    setBusy(action);
    const res = await fetch('/api/emails/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, tone, text: body, thread_id: initial.thread_id }) });
    const d = await res.json(); setBusy('');
    if (d.text) setBody(d.text); else if (d.error) alert(d.error);
  }
  async function send() {
    if (!body.trim() || (!to.trim() && !initial.thread_id)) return;
    setBusy('send');
    const res = await fetch('/api/emails/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, subject, body, thread_id: initial.thread_id }) });
    const d = await res.json(); setBusy('');
    if (d.ok) onSent(); else alert(d.error || 'Send failed');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[88vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">{initial.thread_id ? 'Reply' : 'New message'}</h2>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
        <div className="p-6 space-y-3 overflow-y-auto">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-2"><span className="text-xs font-semibold text-slate-400 w-12">To</span><input className="flex-1 text-sm outline-none" placeholder="name@company.com" value={to} onChange={e => setTo(e.target.value)} disabled={!!initial.thread_id} /></div>
          <div className="flex items-center gap-3 border-b border-slate-100 pb-2"><span className="text-xs font-semibold text-slate-400 w-12">Subject</span><input className="flex-1 text-sm outline-none" placeholder="Add a subject" value={subject} onChange={e => setSubject(e.target.value)} /></div>
          <textarea className="w-full text-sm leading-relaxed outline-none resize-none min-h-[220px]" placeholder="Write your message, or let Claude draft it →" value={body} onChange={e => setBody(e.target.value)} />
        </div>
        <div className="px-6 py-3 border-t border-slate-100 flex items-center gap-2 flex-wrap bg-slate-50/60 rounded-b-2xl">
          <select value={tone} onChange={e => setTone(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none">{TONES.map(t => <option key={t}>{t}</option>)}</select>
          <button onClick={() => ai(body.trim() ? 'improve' : 'draft')} className="text-xs font-semibold text-brand-600 border border-brand-200 bg-brand-50 rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1" disabled={!!busy}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
            {busy ? 'Writing…' : body.trim() ? 'Improve' : 'Draft with Claude'}
          </button>
          {body.trim() && <button onClick={() => ai('shorten')} className="text-xs font-medium text-slate-500 border border-slate-200 rounded-lg px-2.5 py-1.5" disabled={!!busy}>Shorten</button>}
          <button onClick={send} className="btn-primary ml-auto" disabled={!!busy || !body.trim()}>{busy === 'send' ? 'Sending…' : 'Send'}</button>
        </div>
      </div>
    </div>
  );
}

export default function EmailsPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="p-8"><div className="card p-10 h-60 animate-pulse bg-slate-100" /></div>}>
        <EmailsInner />
      </Suspense>
    </AppShell>
  );
}
