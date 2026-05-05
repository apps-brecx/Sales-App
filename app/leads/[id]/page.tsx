'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import StageBadge from '@/components/StageBadge';
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

  const load = () => {
    fetch(`/api/leads/${params.id}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setLead(d); setEditForm(d); setLoading(false); })
      .catch(() => router.push('/leads'));
  };

  useEffect(() => { load(); fetch('/api/users').then(r=>r.json()).then(d=>setUsers(Array.isArray(d)?d:[])); }, [params.id]);

  async function addUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!updateContent.trim() || !lead) return;
    setAddingUpdate(true);
    await fetch('/api/updates', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ lead_id: lead.id, content: updateContent, stage_from: lead.stage, stage_to: updateStage||lead.stage, source:'manual' }) });
    setUpdateContent(''); setUpdateStage(''); setAddingUpdate(false); load();
  }

  async function saveEdit() {
    await fetch(`/api/leads/${lead.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ company_name: editForm.company_name, contact_name: editForm.contact_name||null, contact_email: editForm.contact_email||null, contact_phone: editForm.contact_phone||null, stage: editForm.stage, assigned_to: editForm.assigned_to ? Number(editForm.assigned_to) : null, notes: editForm.notes||null, value: editForm.value||null }) });
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
                <div className="flex items-center gap-3 flex-wrap mb-3">
                  <h1 className="text-2xl font-bold text-slate-900">{lead.company_name}</h1>
                  <StageBadge stage={lead.stage}/>
                  {lead.value && <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200">💰 {lead.value}</span>}
                  {lead.source === 'email' && <span className="badge bg-brand-50 text-brand-600 border-brand-200">📧 Email sourced</span>}
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
                {lead.notes && <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800"><span className="font-semibold">Notes: </span>{lead.notes}</div>}
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
                <div><label className="label">Stage</label><select className="input" value={editForm.stage||'new'} onChange={e=>setEditForm((f:any)=>({...f,stage:e.target.value}))}>{ALL_STAGES.map(s=><option key={s} value={s}>{STAGE_CONFIG[s].label}</option>)}</select></div>
                <div><label className="label">Assigned To</label><select className="input" value={editForm.assigned_to||''} onChange={e=>setEditForm((f:any)=>({...f,assigned_to:e.target.value}))}><option value="">Unassigned</option>{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                <div className="col-span-2"><label className="label">Notes</label><textarea className="input resize-none" rows={2} value={editForm.notes||''} onChange={e=>setEditForm((f:any)=>({...f,notes:e.target.value}))}/></div>
              </div>
              <div className="flex gap-2"><button onClick={saveEdit} className="btn-primary">Save</button><button onClick={()=>setEditMode(false)} className="btn-secondary">Cancel</button></div>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* Add Update */}
          {canEdit && (
            <div className="lg:col-span-3">
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
            </div>
          )}

          {/* Timeline */}
          <div className="lg:col-span-3">
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
      </div>
    </AppShell>
  );
}

function InfoBox({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      {href ? <a href={href} className="text-sm font-medium text-brand-600 hover:underline truncate block">{value}</a>
             : <div className="text-sm font-medium text-slate-700 truncate">{value}</div>}
    </div>
  );
}
