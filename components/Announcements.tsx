'use client';
import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { WHATS_NEW, LATEST_WHATS_NEW, WhatsNewItem } from '@/lib/whatsNew';

export default function Announcements() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const ran = useRef(false);

  const [mode, setMode] = useState<'none' | 'tour' | 'audit'>('none');
  const [tour, setTour] = useState<WhatsNewItem[]>([]);
  const [step, setStep] = useState(0);
  const [auditPending, setAuditPending] = useState(0);
  const auditState = useRef<{ show: boolean; signature: string; key: string }>({ show: false, signature: '', key: '' });

  useEffect(() => {
    const userId = (session?.user as any)?.id;
    const role = (session?.user as any)?.role;
    if (!userId || ran.current) return;
    ran.current = true;

    Promise.all([
      fetch('/api/whats-new').then(r => r.json()).catch(() => ({ seen: LATEST_WHATS_NEW })),
      fetch('/api/audits').then(r => r.json()).catch(() => ({ pending: 0, items: [] })),
    ]).then(([wn, au]) => {
      const seen = Number(wn?.seen || 0);
      const unseen = WHATS_NEW.filter(i => i.id > seen && (!i.roles || i.roles.includes(role)));

      const pending = Number(au?.pending || 0);
      const items: any[] = Array.isArray(au?.items) ? au.items : [];
      const ids = Array.from(new Set(items.filter(i => !i.response_id).map(i => i.audit_id))).sort((a, b) => a - b);
      const signature = `${pending}:${ids.join(',')}`;
      const key = `auditAnnounce_${userId}`;
      const dismissed = typeof window !== 'undefined' ? window.sessionStorage.getItem(key) : signature;
      const auditShow = pending > 0 && pathname !== '/audit' && dismissed !== signature;
      auditState.current = { show: auditShow, signature, key };
      setAuditPending(pending);

      if (unseen.length > 0) { setTour(unseen); setStep(0); setMode('tour'); }
      else if (auditShow) setMode('audit');
    });
  }, [session, pathname]);

  function finishTour() {
    fetch('/api/whats-new', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seen: LATEST_WHATS_NEW }) }).catch(() => {});
    if (auditState.current.show) setMode('audit');
    else setMode('none');
  }

  function dismissAudit(go: boolean) {
    try { window.sessionStorage.setItem(auditState.current.key, auditState.current.signature); } catch {}
    setMode('none');
    if (go) router.push('/audit');
  }

  if (mode === 'tour' && tour.length > 0) {
    const item = tour[step];
    const last = step === tour.length - 1;
    return (
      <Overlay onClose={finishTour}>
        <div className="text-center">
          <div className="text-5xl mb-3">{item.emoji}</div>
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-600 mb-1">What's new</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">{item.title}</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{item.body}</p>
        </div>

        {tour.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-5">
            {tour.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-brand-500' : 'w-1.5 bg-slate-200'}`} />)}
          </div>
        )}

        <div className="flex items-center gap-2 mt-6">
          {step > 0 ? <button onClick={() => setStep(s => s - 1)} className="btn-secondary flex-1 justify-center">Back</button> : <span className="flex-1" />}
          {item.href && (
            <button onClick={() => { finishTour(); router.push(item.href!); }} className="btn-secondary flex-1 justify-center">{item.cta || 'Try it'}</button>
          )}
          {last
            ? <button onClick={finishTour} className="btn-primary flex-1 justify-center">Done</button>
            : <button onClick={() => setStep(s => s + 1)} className="btn-primary flex-1 justify-center">Next</button>}
        </div>
        {!last && <button onClick={finishTour} className="text-xs text-slate-400 hover:text-slate-600 mt-3 mx-auto block">Skip tutorial</button>}
      </Overlay>
    );
  }

  if (mode === 'audit') {
    return (
      <Overlay onClose={() => dismissAudit(false)}>
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">You have an audit to complete</h2>
          <p className="text-sm text-slate-600">{auditPending} {auditPending === 1 ? 'lead is' : 'leads are'} waiting for an audit. Answer the questions and set a plan of action for each.</p>
        </div>
        <div className="flex items-center gap-2 mt-6">
          <button onClick={() => dismissAudit(false)} className="btn-secondary flex-1 justify-center">Later</button>
          <button onClick={() => dismissAudit(true)} className="btn-primary flex-1 justify-center">Review now</button>
        </div>
      </Overlay>
    );
  }

  return null;
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm p-6 relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-300 hover:text-slate-500" aria-label="Close">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
        {children}
      </div>
    </div>
  );
}
