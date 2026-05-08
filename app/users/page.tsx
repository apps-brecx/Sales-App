'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ROLE_CONFIG, cn, timeAgo } from '@/lib/utils';

const ALL_ROLES = ['admin','manager','salesman','viewer'] as const;

export default function UsersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role;
  const selfId = (session?.user as any)?.id;
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [resetUser, setResetUser] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [newForm, setNewForm] = useState({ name:'', email:'', password:'', role:'salesman' });

  useEffect(() => { if (role && role !== 'admin') { router.push('/dashboard'); return; } load(); }, [role]);

  const load = () => fetch('/api/users').then(r=>r.json()).then(d=>{ setUsers(Array.isArray(d)?d:[]); setLoading(false); });
  const flash = (m: string) => { setMsg(m); setTimeout(()=>setMsg(''),3000); };

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newForm) });
    if (res.ok) { flash('User created'); setShowAdd(false); setNewForm({name:'',email:'',password:'',role:'salesman'}); load(); }
    else { const d = await res.json(); flash(d.error||'Failed'); }
  }

  async function changeRole(user: any, newRole: string) {
    await fetch(`/api/users/${user.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ role: newRole }) });
    flash(`${user.name}'s role updated`); load();
  }

  async function toggleActive(user: any) {
    await fetch(`/api/users/${user.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ is_active: user.is_active ? 0 : 1 }) });
    flash(`${user.name} ${user.is_active?'deactivated':'activated'}`); load();
  }

  async function deleteUser(user: any) {
    if (!confirm(`Delete ${user.name}?`)) return;
    await fetch(`/api/users/${user.id}`, { method:'DELETE' });
    flash(`${user.name} deleted`); load();
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    const pw = (e.target as any).password.value;
    await fetch(`/api/users/${resetUser.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: pw }) });
    flash('Password updated'); setResetUser(null);
  }

  return (
    <AppShell>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="page-title">Users</h1><p className="page-sub">Manage team access and roles</p></div>
          <button onClick={()=>setShowAdd(true)} className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Add User
          </button>
        </div>

        {msg && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">{msg}</div>}

        {/* Add modal */}
        {showAdd && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="card p-6 w-full max-w-md shadow-xl animate-slide-up">
              <h2 className="font-bold text-slate-800 mb-5">Add User</h2>
              <form onSubmit={addUser} className="space-y-4">
                <div><label className="label">Full Name</label><input className="input" required placeholder="Jane Smith" value={newForm.name} onChange={e=>setNewForm(f=>({...f,name:e.target.value}))}/></div>
                <div><label className="label">Email</label><input className="input" type="email" required placeholder="jane@company.com" value={newForm.email} onChange={e=>setNewForm(f=>({...f,email:e.target.value}))}/></div>
                <div><label className="label">Password</label><input className="input" type="password" required minLength={6} placeholder="Min 6 characters" value={newForm.password} onChange={e=>setNewForm(f=>({...f,password:e.target.value}))}/></div>
                <div>
                  <label className="label">Role</label>
                  <select className="input" value={newForm.role} onChange={e=>setNewForm(f=>({...f,role:e.target.value}))}>
                    {ALL_ROLES.map(r=><option key={r} value={r}>{ROLE_CONFIG[r].label}</option>)}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">Admin: full access · Manager: can delete · Salesman: add/edit · Viewer: read only</p>
                </div>
                <div className="flex gap-2 pt-2"><button type="submit" className="btn-primary flex-1 justify-center">Create</button><button type="button" onClick={()=>setShowAdd(false)} className="btn-secondary">Cancel</button></div>
              </form>
            </div>
          </div>
        )}

        {/* Reset password modal */}
        {resetUser && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="card p-6 w-full max-w-sm shadow-xl animate-slide-up">
              <h2 className="font-bold text-slate-800 mb-1">Reset Password</h2>
              <p className="text-sm text-slate-400 mb-5">for {resetUser.name}</p>
              <form onSubmit={resetPassword} className="space-y-4">
                <div><label className="label">New Password</label><input name="password" className="input" type="password" required minLength={6} autoFocus placeholder="New password"/></div>
                <div className="flex gap-2"><button type="submit" className="btn-primary flex-1 justify-center">Update</button><button type="button" onClick={()=>setResetUser(null)} className="btn-secondary">Cancel</button></div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">{[...Array(3)].map((_,i)=><div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse"/>)}</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['User','Email','Role','Status','Last Login','Actions'].map(h=><th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map(user => {
                  const rc = ROLE_CONFIG[user.role as keyof typeof ROLE_CONFIG];
                  const isSelf = String(user.id) === String(selfId);
                  return (
                    <tr key={user.id} className={cn('hover:bg-slate-50 transition-colors', !user.is_active && 'opacity-50')}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-brand-100 text-brand-700 rounded-xl flex items-center justify-center font-bold text-sm">{user.name[0]}</div>
                          <div><div className="font-semibold text-slate-800">{user.name}</div>{isSelf && <div className="text-xs text-slate-400">You</div>}</div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{user.email}</td>
                      <td className="px-5 py-4">
                        {isSelf ? <span className={cn('badge', rc.color, rc.bg, rc.border)}>{rc.label}</span> : (
                          <select value={user.role} onChange={e=>changeRole(user,e.target.value)} className={cn('text-xs font-semibold px-2 py-1 rounded-lg border cursor-pointer', rc.color, rc.bg, rc.border)}>
                            {ALL_ROLES.map(r=><option key={r} value={r}>{ROLE_CONFIG[r].label}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={cn('badge', user.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200')}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', user.is_active ? 'bg-emerald-500' : 'bg-slate-400')}/>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {user.last_login_at ? (
                          <div>
                            <div className="text-sm text-slate-700">{timeAgo(user.last_login_at)}</div>
                            <div className="text-xs text-slate-400">{Number(user.login_count || 0)} {Number(user.login_count || 0) === 1 ? 'login' : 'logins'}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Never</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {!isSelf && (
                          <div className="flex gap-2">
                            <button onClick={()=>setResetUser(user)} className="btn-ghost text-xs py-1 px-2">Reset pw</button>
                            <button onClick={()=>toggleActive(user)} className="btn-ghost text-xs py-1 px-2">{user.is_active?'Deactivate':'Activate'}</button>
                            <button onClick={()=>deleteUser(user)} className="px-2 py-1 rounded-lg text-xs text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors">Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
