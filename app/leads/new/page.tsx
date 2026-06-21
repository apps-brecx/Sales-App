'use client';
import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ALL_STAGES, STAGE_CONFIG } from '@/lib/utils';
import Link from 'next/link';

export default function NewLeadPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const isSalesman = role === 'salesman';
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ company_name:'', contact_name:'', contact_email:'', contact_phone:'', stage:'new', assigned_to:'', notes:'', value:'', category:'' });
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/settings').then(r=>r.json()).then(d=>{ try { const a = JSON.parse(d?.lead_categories||'[]'); setCategories(Array.isArray(a)?a:[]); } catch {} }).catch(()=>{});
    if (isSalesman) return; // salesmen don't need the user list (auto-assigned to self)
    fetch('/api/users').then(r=>r.json()).then(d=>setUsers(Array.isArray(d)?d.filter((u:any)=>u.is_active):[]));
  }, [isSalesman]);

  const set = (k: string, v: string) => setForm(f=>({...f,[k]:v}));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name.trim()) return setError('Company name is required');
    setLoading(true); setError('');
    const res = await fetch('/api/leads', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...form, assigned_to: form.assigned_to ? Number(form.assigned_to) : null }) });
    if (res.ok) { const { id } = await res.json(); router.push(`/leads/${id}`); }
    else { const d = await res.json(); setError(d.error||'Failed'); setLoading(false); }
  }

  return (
    <AppShell>
      <div className="p-8 max-w-2xl">
        <div className="mb-6">
          <Link href="/leads" className="text-sm text-slate-400 hover:text-brand-600 transition-colors flex items-center gap-1 mb-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            Back to Leads
          </Link>
          <h1 className="page-title">New Lead</h1>
          <p className="page-sub">Add a lead manually to your pipeline</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">{error}</div>}

          <div>
            <label className="label">Company Name *</label>
            <input className="input" placeholder="Acme Corp" value={form.company_name} onChange={e=>set('company_name',e.target.value)} required/>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Contact Name</label><input className="input" placeholder="John Smith" value={form.contact_name} onChange={e=>set('contact_name',e.target.value)}/></div>
            <div><label className="label">Contact Email</label><input className="input" type="email" placeholder="john@acme.com" value={form.contact_email} onChange={e=>set('contact_email',e.target.value)}/></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Phone</label><input className="input" placeholder="+1 555 000 0000" value={form.contact_phone} onChange={e=>set('contact_phone',e.target.value)}/></div>
            <div><label className="label">Deal Value</label><input className="input" placeholder="e.g. $5,000" value={form.value} onChange={e=>set('value',e.target.value)}/></div>
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={e=>set('category',e.target.value)}>
              <option value="">No category</option>
              {categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className={isSalesman ? '' : 'grid grid-cols-2 gap-4'}>
            <div>
              <label className="label">Stage</label>
              <select className="input" value={form.stage} onChange={e=>set('stage',e.target.value)}>
                {ALL_STAGES.map(s=><option key={s} value={s}>{STAGE_CONFIG[s].label}</option>)}
              </select>
            </div>
            {!isSalesman && (
              <div>
                <label className="label">Assigned To</label>
                <select className="input" value={form.assigned_to} onChange={e=>set('assigned_to',e.target.value)}>
                  <option value="">Unassigned</option>
                  {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div><label className="label">Notes</label><textarea className="input resize-none" rows={3} placeholder="Any notes…" value={form.notes} onChange={e=>set('notes',e.target.value)}/></div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
              {loading ? 'Creating…' : 'Create Lead'}
            </button>
            <Link href="/leads" className="btn-secondary">Cancel</Link>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
