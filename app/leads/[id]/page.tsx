'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import StageBadge from '@/components/StageBadge';
import AuditForm, { AuditItem, AuditQuestion, parseList } from '@/components/AuditForm';
import { Lead, LeadUpdate, LeadStage } from '@/types';
import { ALL_STAGES, STAGE_CONFIG, formatDate, formatDateTime, timeAgo, cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LeadDetailPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role;
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [updateContent, setUpdateContent] = useState('');
  const [updateStage, setUpdateStage] = useState('');
  const [addingUpdate, setAddingUpdate] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [auditItems, setAuditItems] = useState<AuditItem[]>([]);
  const [auditQuestions, setAuditQuestions] = useState<AuditQuestion[]>([]);
  const [actionPresets, setActionPresets] = useState<string[]>([]);
  const [leadCategories, setLeadCategories] = useState<string[]>([]);
  const [naTitle, setNaTitle] = useState('');
  const [naDue, setNaDue] = useState('');
  const [editingAction, setEditingAction] = useState(false);

  const load = () => {
    fetch(`/api/leads/${params.id}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setLead(d); setEditForm(d); setNoteDraft(d.notes || ''); setLoading(false); })
      .catch(() => router.push('/leads'));
  };

  const loadAudits = () => {
    fetch(`/api/audits?lead_id=${params.id}`).then(r => r.json()).then(d => {
      setAuditItems(Array.isArray(d.items) ? d.items : []);
      setAuditQuestions((d.questions || []).map((q: any) => ({ id: q.id, prompt: q.prompt, options: parseList(q.options), allow_other: !!q.allow_other })));
    }).catch(() => {});
  };

  async function saveNote() {
    if (!lead) return;
    if ((noteDraft || '') === (lead.notes || '')) return;
    setSavingNote(true);
    await fetch(`/api/leads/${lead.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ notes: noteDraft || null }) });
    setSavingNote(false); load();
  }

  useEffect(() => {
    load(); loadAudits();
    fetch('/api/users').then(r=>r.json()).then(d=>setUsers(Array.isArray(d)?d:[]));
    fetch('/api/settings').then(r=>r.json()).then(d=>{ setActionPresets(parseList(d?.next_action_presets)); setLeadCategories(parseList(d?.lead_categories)); }).catch(()=>{});
  }, [params.id]);

  async function patchLead(data: Record<string, any>) {
    await fetch(`/api/leads/${lead.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
    load();
  }
  async function saveNextAction() {
    if (!naTitle.trim()) return;
    await patchLead({ next_action: naTitle.trim(), next_action_due: naDue || null });
    setEditingAction(false); setNaTitle(''); setNaDue('');
  }
  function snoozeAction(days: number) {
    const base = lead.next_action_due ? new Date(lead.next_action_due + 'T00:00:00') : new Date();
    base.setDate(base.getDate() + days);
    patchLead({ next_action_due: base.toISOString().slice(0, 10) });
  }
  async function markActionDone() {
    await patchLead({ next_action: null, next_action_due: null });
  }

  async function addUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!updateContent.trim() || !lead) return;
    setAddingUpdate(true);
    await fetch('/api/updates', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ lead_id: lead.id, content: updateContent, stage_from: lead.stage, stage_to: updateStage||lead.stage, source:'manual' }) });
    setUpdateContent(''); setUpdateStage(''); setAddingUpdate(false); load();
  }

  async function saveEdit() {
    await fetch(`/api/leads/${lead.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ company_name: editForm.company_name, contact_name: editForm.contact_name||null, contact_email: editForm.contact_email||null, contact_phone: editForm.contact_phone||null, stage: editForm.stage, assigned_to: editForm.assigned_to ? Number(editForm.assigned_to) : null, notes: editForm.notes||null, value: editForm.value||null, tags: editForm.tags||null, expected_close: editForm.expected_close||null, category: editForm.category||null }) });
    setEditMode(false); load();
  }

  async function deleteLead() {
    if (!confirm(`Move "${lead.company_name}" to trash?`)) return;
    await fetch(`/api/leads/${lead.id}`, { method:'DELETE' });
    router.push('/leads');
  }

  async function deleteUpdate(id: number) {
    if (!confirm('Delete this update?')) return;
    await fetch(`/api/updates/${id}`, { method:'DELETE' }); load();
  }

  if (loading) return <AppShell><div className="p-8"><div className="animate-pulse space-y-4"><div className="h-8 w-48 bg-slate-200 rounded-xl"/><div className="h-40 bg-slate-100 rounded-2xl"/></div></div></AppShell>;
  if (!lead) return null;

  const canEdit = role !== 'viewer';
  const canDelete = ['admin','manager'].includes(role);

  return (
    <AppShell>
      <div className="p-8 max-w-5xl">
        <div className="mb-5">
          <Link href="/leads" className="text-sm text-slate-400 hover:text-brand-600 flex items-center gap-1 mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            All Leads
          </Link>
        </div>

        {/* Lead header card */}
        <div className="card p-6 mb-5">
          {!editMode ? (
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <h1 className="text-2xl font-bold text-slate-900 mr-1">{lead.company_name}</h1>
                  <StageBadge stage={lead.stage}/>
                  {lead.value && <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200">💰 {lead.value}</span>}
                  {lead.source === 'email' && <span className="badge bg-brand-50 text-brand-600 border-brand-200">📧 Email sourced</span>}
                  {lead.tags && String(lead.tags).split(',').map((t: string) => t.trim()).filter(Boolean).map((tag: string) => (
                    <span key={tag} className="badge bg-violet-50 text-violet-700 border-violet-200">#{tag}</span>
                  ))}
                </div>
                {/* Progress bar */}
                <div className="flex items-center gap-3 mb-4">
                  {ALL_STAGES.filter(s=>s!=='closed_lost').map((s,i) => {
                    const idx = ALL_STAGES.indexOf(lead.stage);
                    const sIdx = ALL_STAGES.indexOf(s);
                    const active = sIdx <= idx && lead.stage !== 'closed_lost';
                    const cfg = STAGE_CONFIG[s];
                    return (
                      <div key={s} className="flex items-center gap-2">
                        {i > 0 && <div className={cn('w-8 h-0.5', active ? 'bg-brand-400' : 'bg-slate-200')}/>}
                        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2', active ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-200 text-slate-400')}>
                          {active ? '✓' : i+1}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {lead.contact_name && <InfoBox label="Contact" value={lead.contact_name}/>}
                  {lead.contact_email && <InfoBox label="Email" value={lead.contact_email} href={`mailto:${lead.contact_email}`}/>}
                  {lead.contact_phone && <InfoBox label="Phone" value={lead.contact_phone} href={`tel:${lead.contact_phone}`}/>}
                  {lead.assigned_name && <InfoBox label="Assigned To" value={lead.assigned_name}/>}
                  <InfoBox label="Created" value={formatDate(lead.created_at)}/>
                  <InfoBox label="Last Updated" value={timeAgo(lead.updated_at)}/>
                  <InfoBox label="Updates" value={String(lead.updates?.length||0)}/>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {canEdit && <button onClick={()=>setEditMode(true)} className="btn-secondary"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.83a4 4 0 01-1.897 1.013l-2.796.699.699-2.796A4 4 0 019 13z"/></svg>Edit</button>}
                {canDelete && <button onClick={deleteLead} className="btn-danger"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>Trash</button>}
              </div>
            </div>
          ) : (
            <div>
              <h2 className="font-semibold text-slate-800 mb-4">Edit Lead</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="col-span-2"><label className="label">Company Name</label><input className="input" value={editForm.company_name||''} onChange={e=>setEditForm((f:any)=>({...f,company_name:e.target.value}))}/></div>
                <div><label className="label">Contact Name</label><input className="input" value={editForm.contact_name||''} onChange={e=>setEditForm((f:any)=>({...f,contact_name:e.target.value}))}/></div>
                <div><label className="label">Contact Email</label><input className="input" value={editForm.contact_email||''} onChange={e=>setEditForm((f:any)=>({...f,contact_email:e.target.value}))}/></div>
                <div><label className="label">Phone</label><input className="input" value={editForm.contact_phone||''} onChange={e=>setEditForm((f:any)=>({...f,contact_phone:e.target.value}))}/></div>
                <div><label className="label">Deal Value</label><input className="input" value={editForm.value||''} onChange={e=>setEditForm((f:any)=>({...f,value:e.target.value}))}/></div>
                <div><label className="label">Expected Close</label><input type="date" className="input" value={editForm.expected_close||''} onChange={e=>setEditForm((f:any)=>({...f,expected_close:e.target.value}))}/></div>
                <div><label className="label">Stage</label><select className="input" value={editForm.stage||'new'} onChange={e=>setEditForm((f:any)=>({...f,stage:e.target.value}))}>{ALL_STAGES.map(s=><option key={s} value={s}>{STAGE_CONFIG[s].label}</option>)}</select></div>
                <div><label className="label">Assigned To</label><select className="input" value={editForm.assigned_to||''} onChange={e=>setEditForm((f:any)=>({...f,assigned_to:e.target.value}))}><option value="">Unassigned</option>{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                <div><label className="label">Category</label><select className="input" value={editForm.category||''} onChange={e=>setEditForm((f:any)=>({...f,category:e.target.value}))}><option value="">No category</option>{leadCategories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                <div className="col-span-2"><label className="label">Tags</label><input className="input" placeholder="warm, decision-maker, urgent" value={editForm.tags||''} onChange={e=>setEditForm((f:any)=>({...f,tags:e.target.value}))}/><p className="text-xs text-slate-400 mt-1">Comma-separated</p></div>
                <div className="col-span-2"><label className="label">Notes</label><textarea className="input resize-none" rows={2} value={editForm.notes||''} onChange={e=>setEditForm((f:any)=>({...f,notes:e.target.value}))}/></div>
              </div>
              <div className="flex gap-2"><button onClick={saveEdit} className="btn-primary">Save</button><button onClick={()=>setEditMode(false)} className="btn-secondary">Cancel</button></div>
            </div>
          )}
        </div>

        {/* Two-column body */}
        <div className="grid lg:grid-cols-3 gap-5 items-start">
          {/* Left: notes + activity */}
          <div className="lg:col-span-2 space-y-5">
            {/* Sticky Notes */}
            {canEdit && (
              <div className="card p-5 bg-amber-50/50 border-amber-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2"><span className="text-xl">📌</span><h3 className="font-semibold text-amber-900">Notes & Context</h3></div>
                  {savingNote && <span className="text-xs text-amber-600">Saving…</span>}
                </div>
                <textarea className="w-full bg-transparent text-sm text-amber-900 placeholder-amber-400 resize-none outline-none border-0 focus:ring-0" rows={3}
                  placeholder="Decision-maker, budget cycle, what they care about, anything that helps you remember context…"
                  value={noteDraft} onChange={e => setNoteDraft(e.target.value)} onBlur={saveNote} />
              </div>
            )}
            {!canEdit && lead.notes && (
              <div className="card p-5 bg-amber-50/50 border-amber-100">
                <div className="flex items-center gap-2 mb-2"><span className="text-xl">📌</span><h3 className="font-semibold text-amber-900">Notes & Context</h3></div>
                <p className="text-sm text-amber-900 whitespace-pre-wrap">{lead.notes}</p>
              </div>
            )}

            {/* Add Update */}
            {canEdit && (
              <div className="card p-5">
                <h3 className="font-semibold text-slate-800 mb-4">Add Update</h3>
                <form onSubmit={addUpdate} className="space-y-3">
                  <textarea className="input resize-none" rows={3} placeholder="What happened? Meeting notes, follow-up actions, any progress…" value={updateContent} onChange={e=>setUpdateContent(e.target.value)} required/>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="label">Move to Stage (optional)</label>
                      <select className="input" value={updateStage} onChange={e=>setUpdateStage(e.target.value)}>
                        <option value="">Keep current — {STAGE_CONFIG[lead.stage as LeadStage].label}</option>
                        {ALL_STAGES.map(s=><option key={s} value={s}>{STAGE_CONFIG[s].label}</option>)}
                      </select>
                    </div>
                    <div className="mt-5">
                      <button type="submit" className="btn-primary" disabled={addingUpdate||!updateContent.trim()}>
                        {addingUpdate && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                        {addingUpdate ? 'Saving…' : 'Add Update'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {/* Timeline */}
            <div>
              <h3 className="font-semibold text-slate-800 mb-4">Activity Timeline <span className="text-slate-400 font-normal text-sm ml-1">({lead.updates?.length||0})</span></h3>
              {!lead.updates?.length ? (
                <div className="card p-12 text-center"><div className="text-3xl mb-2">📋</div><div className="text-sm text-slate-400">No updates yet</div></div>
              ) : (
                <div className="relative">
                  <div className="absolute left-5 top-4 bottom-4 w-px bg-slate-100"/>
                  <div className="space-y-3">
                    {lead.updates.map((u: LeadUpdate & { user_name?: string }) => (
                      <div key={u.id} className="relative flex gap-4 group">
                        <div className={cn('relative z-10 w-10 h-10 rounded-xl flex items-center justify-center shrink-0', u.source==='email' ? 'bg-brand-50 border border-brand-200' : 'bg-slate-50 border border-slate-200')}>
                          {u.source==='email'
                            ? <svg className="w-4 h-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8"/></svg>
                            : <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.83a4 4 0 01-1.897 1.013l-2.796.699.699-2.796A4 4 0 019 13z"/></svg>
                          }
                        </div>
                        <div className="flex-1 card p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {u.user_name && <span className="text-xs font-semibold text-slate-700">{u.user_name}</span>}
                              {u.stage_from && u.stage_to && u.stage_from !== u.stage_to && (
                                <span className="flex items-center gap-1 text-xs">
                                  <StageBadge stage={u.stage_from as LeadStage}/>
                                  <span className="text-slate-400">→</span>
                                  <StageBadge stage={u.stage_to as LeadStage}/>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-slate-400">{formatDateTime(u.created_at)}</span>
                              {canDelete && <button onClick={()=>deleteUpdate(u.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>}
                            </div>
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed">{u.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right rail */}
          <div className="space-y-5">
            {/* Deal value */}
            <div className="card p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Deal value</div>
              <div className="text-3xl font-bold text-slate-900">{lead.value ? formatMoney(lead.value) : '—'}</div>
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Expected close</span><span className="font-medium text-slate-700">{lead.expected_close ? formatDate(lead.expected_close) : '—'}</span></div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1"><span className="text-slate-500">Lead score</span><span className="font-bold" style={{ color: scoreColor(leadScore(lead)) }}>{leadScore(lead)}/100</span></div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${leadScore(lead)}%`, background: scoreColor(leadScore(lead)) }}/></div>
                </div>
              </div>
            </div>

            {/* Next action */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <h3 className="font-semibold text-slate-800">Next action</h3>
                </div>
                {lead.next_action && lead.next_action_due && (() => {
                  const todayStr = new Date().toISOString().slice(0,10);
                  const overdue = lead.next_action_due < todayStr;
                  return <span className={cn('badge', overdue ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-brand-50 text-brand-700 border-brand-200')}>Due {formatDate(lead.next_action_due)}</span>;
                })()}
              </div>

              {lead.next_action && !editingAction ? (
                <>
                  <div className="text-sm font-medium text-slate-800">{lead.next_action}</div>
                  {canEdit && (
                    <div className="flex gap-2 mt-4">
                      <button onClick={markActionDone} className="btn-primary flex-1 justify-center">Mark done</button>
                      <button onClick={() => snoozeAction(3)} className="btn-secondary" title="Push 3 days">Snooze</button>
                    </div>
                  )}
                  {canEdit && <button onClick={() => { setEditingAction(true); setNaTitle(lead.next_action); setNaDue(lead.next_action_due || ''); }} className="text-xs text-slate-400 hover:text-brand-600 mt-3">Change</button>}
                </>
              ) : canEdit ? (
                <div className="space-y-2.5">
                  <input list="naPresets" className="input" placeholder="What's the next step?" value={naTitle} onChange={e => setNaTitle(e.target.value)} />
                  <datalist id="naPresets">{actionPresets.map(p => <option key={p} value={p} />)}</datalist>
                  {actionPresets.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {actionPresets.slice(0, 6).map(p => (
                        <button key={p} type="button" onClick={() => setNaTitle(p)} className={cn('px-2.5 py-1 rounded-full text-xs font-medium border', naTitle === p ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300')}>{p}</button>
                      ))}
                    </div>
                  )}
                  <input type="date" className="input" value={naDue} onChange={e => setNaDue(e.target.value)} />
                  <div className="flex gap-2">
                    <button onClick={saveNextAction} className="btn-primary flex-1 justify-center" disabled={!naTitle.trim()}>Set action</button>
                    {editingAction && lead.next_action && <button onClick={() => { setEditingAction(false); setNaTitle(''); setNaDue(''); }} className="btn-secondary">Cancel</button>}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-400">No next action set.</div>
              )}
            </div>

            {/* Contact */}
            {(lead.contact_name || lead.contact_email || lead.contact_phone) && (
              <div className="card p-5">
                <h3 className="font-semibold text-slate-800 mb-3">Contact</h3>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center shrink-0">
                    {(lead.contact_name || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">{lead.contact_name || '—'}</div>
                    {lead.assigned_name && <div className="text-xs text-slate-400 truncate">rep · {lead.assigned_name}</div>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {lead.contact_phone && <a href={`tel:${lead.contact_phone}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-brand-600 rounded-lg px-2 py-1.5 hover:bg-slate-50"><svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>{lead.contact_phone}</a>}
                  {lead.contact_email && <a href={`mailto:${lead.contact_email}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-brand-600 rounded-lg px-2 py-1.5 hover:bg-slate-50 truncate"><svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg><span className="truncate">{lead.contact_email}</span></a>}
                </div>
              </div>
            )}

            {/* Emails for this lead */}
            <Link href={`/emails?lead=${lead.id}`} className="card p-4 flex items-center gap-3 hover:border-brand-200 transition-colors group">
              <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 group-hover:text-brand-600">Emails</div>
                <div className="text-xs text-slate-400">This lead's email conversation</div>
              </div>
              <svg className="w-4 h-4 text-slate-300 group-hover:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </Link>

            {/* Audit */}
            {auditItems.length > 0 && (
              <div className="card p-5 border-brand-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                  </div>
                  <h3 className="font-semibold text-slate-800">Audit</h3>
                  {auditItems.some(i => !i.response_id) && <span className="badge bg-amber-50 text-amber-700 border-amber-200">{auditItems.filter(i => !i.response_id).length} pending</span>}
                </div>
                <div className="space-y-2">
                  {auditItems.map(item => (
                    <LeadAuditItem key={`${item.audit_id}-${item.lead_id}`} item={item} questions={auditQuestions} onSaved={() => { loadAudits(); load(); }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function LeadAuditItem({ item, questions, onSaved }: { item: AuditItem; questions: AuditQuestion[]; onSaved: () => void }) {
  const isDone = !!item.response_id;
  const [open, setOpen] = useState(!isDone);
  return (
    <div className={cn('rounded-xl border', isDone ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200')}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 text-left p-3">
        <div className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0', isDone ? 'bg-emerald-500' : 'border-2 border-amber-300')}>
          {isDone && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-800 truncate">{item.title || `Audit · ${formatDate(item.audit_date)}`}</div>
          <div className="text-xs text-slate-400 truncate">
            covers {item.period_start ? `${formatDate(item.period_start)} – ` : 'up to '}{formatDate(item.audit_date)} · {isDone ? 'completed' : 'pending'}
          </div>
        </div>
        {!isDone && <span className="badge bg-amber-50 text-amber-700 border-amber-200 shrink-0">Pending</span>}
        <svg className={cn('w-4 h-4 text-slate-300 transition-transform shrink-0', open && 'rotate-90')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
      </button>
      {open && <div className="px-4 pb-4 pt-1"><AuditForm item={item} questions={questions} onSaved={onSaved} /></div>}
    </div>
  );
}

function formatMoney(v: any): string {
  const raw = String(v).trim();
  if (!raw) return '—';
  if (/[a-zA-Z]/.test(raw)) return raw.startsWith('$') ? raw : '$' + raw;
  const n = parseFloat(raw.replace(/[^\d.]/g, ''));
  if (isNaN(n)) return raw;
  return n >= 1000 ? `$${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : `$${n.toLocaleString()}`;
}
function leadScore(lead: any): number {
  const stageBase: Record<string, number> = { new: 22, contacted: 42, follow_up: 58, proposal: 78, closed_won: 100, closed_lost: 8 };
  let s = stageBase[lead.stage] ?? 30;
  const days = lead.updated_at ? (Date.now() - new Date(lead.updated_at).getTime()) / 86400000 : 999;
  if (days <= 3) s += 12; else if (days <= 7) s += 6; else if (days > 21) s -= 12; else if (days > 14) s -= 6;
  s += Math.min(10, lead.updates?.length || 0);
  if (lead.value) s += 4;
  return Math.max(0, Math.min(100, Math.round(s)));
}
function scoreColor(n: number): string { return n >= 70 ? '#10b981' : n >= 45 ? '#f59e0b' : '#f43f5e'; }

function InfoBox({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      {href ? <a href={href} className="text-sm font-medium text-brand-600 hover:underline truncate block">{value}</a>
             : <div className="text-sm font-medium text-slate-700 truncate">{value}</div>}
    </div>
  );
}
