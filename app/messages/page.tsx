'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { useSession } from 'next-auth/react';
import { timeAgo, cn } from '@/lib/utils';

export default function MessagesPage() {
  const { data: session } = useSession();
  const myId = (session?.user as any)?.id;
  const [messages, setMessages] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [tab, setTab] = useState<'inbox'|'sent'>('inbox');
  const [form, setForm] = useState({ to_user_id:'', subject:'', body:'', lead_id:'' });
  const [sending, setSending] = useState(false);

  const load = () => fetch('/api/messages').then(r=>r.json()).then(d=>setMessages(Array.isArray(d)?d:[]));
  useEffect(() => {
    load();
    fetch('/api/users').then(r=>r.json()).then(d=>setUsers(Array.isArray(d)?d:[]));
    fetch('/api/leads').then(r=>r.json()).then(d=>setLeads(Array.isArray(d)?d:[]));
  }, []);

  const inbox = messages.filter(m => String(m.to_user_id) === String(myId));
  const sent = messages.filter(m => String(m.from_user_id) === String(myId));
  const list = tab === 'inbox' ? inbox : sent;
  const unread = inbox.filter(m => !m.is_read).length;

  async function open(msg: any) {
    setSelected(msg);
    if (!msg.is_read && String(msg.to_user_id) === String(myId)) {
      await fetch(`/api/messages/${msg.id}`, { method:'PATCH' });
      load();
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    await fetch('/api/messages', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...form, to_user_id: form.to_user_id ? Number(form.to_user_id) : null, lead_id: form.lead_id ? Number(form.lead_id) : null }) });
    setSending(false); setShowCompose(false); setForm({ to_user_id:'',subject:'',body:'',lead_id:'' }); load();
  }

  async function deleteMsg(id: number) {
    await fetch(`/api/messages/${id}`, { method:'DELETE' });
    if (selected?.id === id) setSelected(null);
    load();
  }

  return (
    <AppShell>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="page-title">Messages</h1><p className="page-sub">Internal team messaging</p></div>
          <button onClick={()=>setShowCompose(true)} className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.83a4 4 0 01-1.897 1.013l-2.796.699.699-2.796A4 4 0 019 13z"/></svg>
            Compose
          </button>
        </div>

        {/* Compose modal */}
        {showCompose && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="card p-6 w-full max-w-lg shadow-xl animate-slide-up">
              <h2 className="font-bold text-slate-800 mb-5">New Message</h2>
              <form onSubmit={send} className="space-y-4">
                <div><label className="label">To</label>
                  <select className="input" value={form.to_user_id} onChange={e=>setForm(f=>({...f,to_user_id:e.target.value}))}>
                    <option value="">All Team (broadcast)</option>
                    {users.filter(u=>String(u.id)!==String(myId)).map(u=><option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                  </select>
                </div>
                <div><label className="label">Subject *</label><input className="input" required placeholder="Subject…" value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))}/></div>
                <div><label className="label">Link to Lead</label>
                  <select className="input" value={form.lead_id} onChange={e=>setForm(f=>({...f,lead_id:e.target.value}))}>
                    <option value="">None</option>
                    {leads.map(l=><option key={l.id} value={l.id}>{l.company_name}</option>)}
                  </select>
                </div>
                <div><label className="label">Message *</label><textarea className="input resize-none" rows={5} required placeholder="Write your message…" value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))}/></div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" className="btn-primary flex-1 justify-center" disabled={sending}>{sending?'Sending…':'Send Message'}</button>
                  <button type="button" onClick={()=>setShowCompose(false)} className="btn-secondary">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-5 h-[calc(100vh-14rem)]">
          {/* List */}
          <div className="card overflow-hidden flex flex-col">
            <div className="flex border-b border-slate-100">
              <button onClick={()=>setTab('inbox')} className={cn('flex-1 py-3 text-sm font-semibold transition-colors', tab==='inbox' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-500 hover:text-slate-700')}>
                Inbox {unread > 0 && <span className="ml-1 w-5 h-5 bg-rose-500 text-white text-xs rounded-full inline-flex items-center justify-center">{unread}</span>}
              </button>
              <button onClick={()=>setTab('sent')} className={cn('flex-1 py-3 text-sm font-semibold transition-colors', tab==='sent' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-500 hover:text-slate-700')}>Sent</button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
              {list.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">{tab === 'inbox' ? 'No messages' : 'No sent messages'}</div>}
              {list.map(msg => (
                <div key={msg.id} onClick={()=>open(msg)}
                  className={cn('p-4 cursor-pointer transition-colors group hover:bg-slate-50', selected?.id===msg.id ? 'bg-brand-50' : '', tab==='inbox' && !msg.is_read ? 'bg-brand-50/50' : '')}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      {tab==='inbox' && !msg.is_read && <span className="w-2 h-2 bg-brand-500 rounded-full shrink-0"/>}
                      <span className="text-xs font-semibold text-slate-700">{tab==='inbox' ? msg.from_name : (msg.to_name||'All Team')}</span>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{timeAgo(msg.created_at)}</span>
                  </div>
                  <div className="text-sm font-medium text-slate-800 truncate">{msg.subject}</div>
                  <div className="text-xs text-slate-400 truncate mt-0.5">{msg.body}</div>
                  {msg.lead_name && <div className="text-xs text-brand-500 mt-1 truncate">📎 {msg.lead_name}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Message detail */}
          <div className="card p-6 lg:col-span-2 overflow-y-auto">
            {!selected ? (
              <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-3">
                <svg className="w-12 h-12 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
                <span className="text-sm">Select a message to read</span>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 mb-1">{selected.subject}</h2>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      <span>From: <strong>{selected.from_name}</strong></span>
                      <span>To: <strong>{selected.to_name||'All Team'}</strong></span>
                      <span>{timeAgo(selected.created_at)}</span>
                    </div>
                    {selected.lead_name && <div className="mt-1 text-sm text-brand-600">📎 Linked to: {selected.lead_name}</div>}
                  </div>
                  <button onClick={()=>deleteMsg(selected.id)} className="btn-danger text-xs">Delete</button>
                </div>
                <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-xl p-4 border border-slate-100">{selected.body}</div>
                <div className="mt-4">
                  <button onClick={()=>{ setForm(f=>({...f, to_user_id:String(selected.from_user_id), subject:`Re: ${selected.subject}`})); setShowCompose(true); }} className="btn-secondary text-xs">
                    ↩ Reply
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
