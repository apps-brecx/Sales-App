'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import StageBadge from '@/components/StageBadge';
import AuditForm, { AuditItem, AuditQuestion, parseList, parseAnswers } from '@/components/AuditForm';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { formatDate, timeAgo } from '@/lib/utils';
import { LeadStage } from '@/types';

const PAGE_SIZE = 50;
const PLAN_STATUS_CHIP: Record<string, string> = {
  executed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partly: 'bg-amber-50 text-amber-700 border-amber-200',
  not: 'bg-rose-50 text-rose-700 border-rose-200',
};
const PLAN_STATUS_LABEL: Record<string, string> = { executed: 'Executed', partly: 'Partly done', not: 'Not done' };

function rawToQuestions(raw: any[]): AuditQuestion[] {
  return (raw || []).map((q: any) => ({ id: q.id, prompt: q.prompt, options: parseList(q.options), allow_other: !!q.allow_other }));
}

export default function AuditPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const isStaff = role === 'admin' || role === 'manager';

  return (
    <AppShell>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="page-title">Lead Audits</h1>
          <p className="page-sub">{isStaff
            ? 'Audits you’ve scheduled and how far each rep has gotten. Create new audits in Settings → Audit Questions.'
            : 'Review each lead an audit asks for — answer the questions, check last time’s plan, and set the next plan of action.'}</p>
        </div>
        {isStaff ? <StaffView /> : <RepView />}
      </div>
    </AppShell>
  );
}

function RepView() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [questions, setQuestions] = useState<AuditQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  function load(p = page) {
    setLoading(true);
    fetch(`/api/audits?page=${p}`).then(r => r.json()).then(d => {
      setItems(Array.isArray(d.items) ? d.items : []);
      setQuestions(rawToQuestions(d.questions));
      setTotal(Number(d.total || 0));
      setLoading(false);
    }).catch(() => setLoading(false));
  }
  useEffect(() => { load(page); /* eslint-disable-next-line */ }, [page]);

  const pending = items.filter(i => !i.response_id).length;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  if (loading && items.length === 0) return <div className="card p-8 animate-pulse h-40 bg-slate-100" />;

  if (total === 0) {
    return <div className="card p-12 text-center text-slate-400">No audits assigned to you right now. When an admin schedules one, your leads will show up here.</div>;
  }

  return (
    <>
      <div className="card p-5 mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-lg font-bold text-slate-900">{total} {total === 1 ? 'lead' : 'leads'} to review</div>
          <div className="text-xs text-slate-400 mt-0.5">{pending > 0 ? `${pending} still pending on this page` : 'All on this page done'}</div>
        </div>
        <span className="badge bg-brand-50 text-brand-700 border-brand-200">Page {page + 1} of {lastPage + 1}</span>
      </div>

      <div className="space-y-3">
        {items.map(item => <RepAuditCard key={`${item.audit_id}-${item.lead_id}`} item={item} questions={questions} onSaved={() => load(page)} />)}
      </div>

      {lastPage > 0 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button className="btn-secondary text-sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>← Prev</button>
          <span className="text-sm text-slate-400">Page {page + 1} / {lastPage + 1}</span>
          <button className="btn-secondary text-sm" disabled={page >= lastPage} onClick={() => setPage(p => Math.min(lastPage, p + 1))}>Next →</button>
        </div>
      )}
    </>
  );
}

function RepAuditCard({ item, questions, onSaved }: { item: AuditItem; questions: AuditQuestion[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const isDone = !!item.response_id;
  return (
    <div className={`card p-4 ${isDone ? 'border-emerald-200' : ''}`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 text-left">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isDone ? 'bg-emerald-500' : 'border-2 border-slate-300'}`}>
          {isDone && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-800 truncate">{item.company_name}</div>
          <div className="text-xs text-slate-400 truncate">
            {item.contact_name ? item.contact_name + ' · ' : ''}
            Audit {formatDate(item.audit_date)}
            {isDone ? ` · done ${item.response_updated_at ? timeAgo(item.response_updated_at) : ''}` : ''}
          </div>
        </div>
        {!isDone && <span className="badge bg-amber-50 text-amber-700 border-amber-200 shrink-0">Pending</span>}
        <StageBadge stage={item.stage as LeadStage} />
        <svg className={`w-4 h-4 text-slate-300 transition-transform shrink-0 ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
      </button>
      {open && (
        <div className="mt-4 pl-9">
          <div className="mb-3 text-xs text-slate-400">
            Covers {item.period_start ? `${formatDate(item.period_start)} – ` : 'up to '}{formatDate(item.audit_date)} ·{' '}
            <Link href={`/leads/${item.lead_id}`} className="text-brand-600 hover:underline">open lead</Link>
          </div>
          <AuditForm item={item} questions={questions} onSaved={onSaved} />
        </div>
      )}
    </div>
  );
}

function StaffView() {
  const [audits, setAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  function load() {
    fetch('/api/audits?manage=1').then(r => r.json()).then(d => {
      setAudits(Array.isArray(d.audits) ? d.audits : []); setLoading(false);
    }).catch(() => setLoading(false));
  }
  useEffect(load, []);

  if (loading) return <div className="card p-8 animate-pulse h-40 bg-slate-100" />;
  if (audits.length === 0) {
    return (
      <div className="card p-12 text-center">
        <p className="text-slate-400 mb-3">No audits scheduled yet.</p>
        <Link href="/settings" className="btn-primary inline-flex">Schedule an audit in Settings</Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {audits.map(a => {
        const target = Number(a.target_count) || 0;
        const done = Number(a.done_count) || 0;
        const pct = target > 0 ? Math.round((done / target) * 100) : 100;
        const isOpen = openId === a.id;
        return (
          <div key={a.id} className="card p-4">
            <button onClick={() => setOpenId(isOpen ? null : a.id)} className="w-full flex items-center gap-3 text-left">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800">
                  {a.title || `Audit · ${formatDate(a.audit_date)}`}
                  {a.is_closed ? <span className="badge bg-slate-100 text-slate-500 border-slate-200 ml-2">Closed</span> : null}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {a.period_start ? `${formatDate(a.period_start)} – ` : 'Up to '}{formatDate(a.audit_date)} · {a.scope === 'all' ? 'all leads' : 'selected leads'}
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden max-w-xs">
                  <div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="text-sm font-semibold text-slate-700 w-16 text-right">{done}/{target}</div>
              <svg className={`w-4 h-4 text-slate-300 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </button>
            {isOpen && <AuditDetail auditId={a.id} />}
          </div>
        );
      })}
    </div>
  );
}

function AuditDetail({ auditId }: { auditId: number }) {
  const [data, setData] = useState<{ questions: AuditQuestion[]; targets: any[] } | null>(null);
  useEffect(() => {
    fetch(`/api/audits?audit_id=${auditId}`).then(r => r.json()).then(d => setData({
      questions: rawToQuestions(d.questions),
      targets: Array.isArray(d.audit?.targets) ? d.audit.targets : [],
    })).catch(() => setData({ questions: [], targets: [] }));
  }, [auditId]);

  if (data === null) return <div className="mt-3 h-12 animate-pulse bg-slate-50 rounded-lg" />;
  if (data.targets.length === 0) return <div className="mt-3 text-xs text-slate-400">No leads in this audit.</div>;

  const promptOf = (id: string) => data.questions.find(q => String(q.id) === id)?.prompt || 'Question';

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-4">
      {data.targets.map((t: any) => {
        const answers = parseAnswers(t.answers);
        const status = t.prev_plan_status ? t.prev_plan_status : null;
        return (
          <div key={t.lead_id} className="text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/leads/${t.lead_id}`} className="font-medium text-slate-700 hover:text-brand-600">{t.company_name}</Link>
              <StageBadge stage={t.stage as LeadStage} />
              {t.assigned_name && <span className="text-xs text-slate-400">{t.assigned_name}</span>}
              {!t.response_id && <span className="text-xs text-rose-500 font-medium">not done</span>}
            </div>
            {t.response_id && (
              <div className="mt-1.5 pl-1 space-y-2">
                {Object.keys(answers).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(answers).map(([qid, val]) => (
                      <span key={qid} className="inline-flex items-center gap-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                        <span className="text-slate-400">{promptOf(qid)}:</span>
                        <span className="text-slate-700 font-medium">{String(val)}</span>
                      </span>
                    ))}
                  </div>
                )}
                {status && (
                  <div className="text-xs">
                    <span className="text-slate-400">Last plan: </span>
                    <span className={`inline-flex items-center badge border ${PLAN_STATUS_CHIP[status]}`}>{PLAN_STATUS_LABEL[status]}</span>
                    {t.prev_plan_note && <span className="text-slate-500"> — {t.prev_plan_note}</span>}
                  </div>
                )}
                <div className="text-xs"><span className="font-semibold text-slate-500">Plan:</span> <span className="text-slate-600 whitespace-pre-wrap">{t.plan_text}</span></div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
