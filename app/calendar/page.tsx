'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { useSession } from 'next-auth/react';
import { EVENT_TYPES, cn, formatDate } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, parseISO, addMonths, subMonths } from 'date-fns';

const TYPE_COLORS: Record<string, string> = {
  Meeting: 'bg-brand-100 text-brand-700 border-brand-200',
  Call: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Follow-up': 'bg-amber-100 text-amber-700 border-amber-200',
  Demo: 'bg-violet-100 text-violet-700 border-violet-200',
  Proposal: 'bg-orange-100 text-orange-700 border-orange-200',
  Other: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function CalendarPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<any[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [leads, setLeads] = useState<any[]>([]);
  const [form, setForm] = useState({ title:'', description:'', event_date: new Date().toISOString().split('T')[0], event_time:'', type:'Meeting', lead_id:'' });
  const [saving, setSaving] = useState(false);

  const load = () => { fetch('/api/calendar').then(r=>r.json()).then(d=>setEvents(Array.isArray(d)?d:[])); };
  useEffect(() => { load(); fetch('/api/leads').then(r=>r.json()).then(d=>setLeads(Array.isArray(d)?d:[])); }, []);

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startDay = startOfMonth(currentMonth).getDay();

  function eventsOnDay(date: Date) {
    return events.filter(e => { try { return isSameDay(parseISO(e.event_date), date); } catch { return false; } });
  }

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch('/api/calendar', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...form, lead_id: form.lead_id ? Number(form.lead_id) : null }) });
    setSaving(false); setShowAdd(false); setForm(f=>({...f,title:'',description:'',event_time:'',lead_id:''})); load();
  }

  async function deleteEvent(id: number) {
    await fetch(`/api/calendar/${id}`, { method:'DELETE' }); load();
  }

  const upcomingEvents = events.filter(e => { try { return parseISO(e.event_date) >= new Date(new Date().setHours(0,0,0,0)); } catch { return false; } }).slice(0,10);

  return (
    <AppShell>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div><h1 className="page-title">Calendar</h1><p className="page-sub">Schedule meetings, calls, and follow-ups</p></div>
          <button onClick={()=>setShowAdd(true)} className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            New Event
          </button>
        </div>

        {/* Add modal */}
        {showAdd && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="card p-6 w-full max-w-md shadow-xl animate-slide-up">
              <h2 className="font-bold text-slate-800 mb-5">New Event</h2>
              <form onSubmit={addEvent} className="space-y-4">
                <div><label className="label">Title *</label><input className="input" placeholder="Meeting with Acme Corp" required value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Date *</label><input type="date" className="input" required value={form.event_date} onChange={e=>setForm(f=>({...f,event_date:e.target.value}))}/></div>
                  <div><label className="label">Time</label><input type="time" className="input" value={form.event_time} onChange={e=>setForm(f=>({...f,event_time:e.target.value}))}/></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Type</label><select className="input" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>{EVENT_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
                  <div><label className="label">Linked Lead</label><select className="input" value={form.lead_id} onChange={e=>setForm(f=>({...f,lead_id:e.target.value}))}><option value="">None</option>{leads.map(l=><option key={l.id} value={l.id}>{l.company_name}</option>)}</select></div>
                </div>
                <div><label className="label">Notes</label><textarea className="input resize-none" rows={2} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/></div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>{saving?'Saving…':'Add Event'}</button>
                  <button type="button" onClick={()=>setShowAdd(false)} className="btn-secondary">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Calendar grid */}
          <div className="card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-slate-800 text-lg">{format(currentMonth,'MMMM yyyy')}</h2>
              <div className="flex gap-1">
                <button onClick={()=>setCurrentMonth(subMonths(currentMonth,1))} className="btn-ghost p-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg></button>
                <button onClick={()=>setCurrentMonth(new Date())} className="btn-ghost px-3 py-1 text-xs">Today</button>
                <button onClick={()=>setCurrentMonth(addMonths(currentMonth,1))} className="btn-ghost p-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg></button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {[...Array(startDay)].map((_,i)=><div key={`e${i}`}/>)}
              {days.map(day => {
                const dayEvents = eventsOnDay(day);
                const today = isToday(day);
                return (
                  <div key={day.toISOString()} className={cn('min-h-16 p-1.5 rounded-xl border cursor-pointer transition-colors', today ? 'border-brand-300 bg-brand-50' : 'border-transparent hover:bg-slate-50')}
                    onClick={()=>{ setForm(f=>({...f,event_date:format(day,'yyyy-MM-dd')})); setShowAdd(true); }}>
                    <div className={cn('text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full', today ? 'bg-brand-600 text-white' : 'text-slate-600')}>{format(day,'d')}</div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0,2).map(ev=>(
                        <div key={ev.id} className={cn('text-[10px] px-1 py-0.5 rounded font-medium truncate border', TYPE_COLORS[ev.type]||TYPE_COLORS.Other)}>{ev.title}</div>
                      ))}
                      {dayEvents.length > 2 && <div className="text-[10px] text-slate-400 pl-1">+{dayEvents.length-2} more</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming */}
          <div className="card p-5">
            <h2 className="font-bold text-slate-800 mb-4">Upcoming Events</h2>
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">No upcoming events</div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map(ev => (
                  <div key={ev.id} className="group flex gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="text-center shrink-0">
                      <div className="text-xs font-semibold text-slate-500">{format(parseISO(ev.event_date),'MMM')}</div>
                      <div className="text-xl font-bold text-slate-800">{format(parseISO(ev.event_date),'d')}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-slate-800 truncate">{ev.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn('badge text-[10px]', TYPE_COLORS[ev.type]||TYPE_COLORS.Other)}>{ev.type}</span>
                        {ev.event_time && <span className="text-xs text-slate-400">{ev.event_time}</span>}
                      </div>
                      {ev.lead_name && <div className="text-xs text-slate-400 mt-0.5 truncate">📎 {ev.lead_name}</div>}
                    </div>
                    <button onClick={()=>deleteEvent(ev.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
