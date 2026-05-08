'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

type Task = {
  id: number;
  user_id: number;
  lead_id: number | null;
  lead_name: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completed, setCompleted] = useState<Task[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New task form
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [leadId, setLeadId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function load() {
    Promise.all([
      fetch('/api/tasks').then(r => r.json()),
      fetch('/api/tasks?completed=true').then(r => r.json()),
      fetch('/api/leads').then(r => r.json()),
    ]).then(([open, all, leads]) => {
      const openArr = Array.isArray(open) ? open : [];
      const allArr = Array.isArray(all) ? all : [];
      setTasks(openArr);
      setCompleted(allArr.filter((t: Task) => t.completed_at));
      setLeads(Array.isArray(leads) ? leads : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }
  useEffect(load, []);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, due_date: dueDate || null, lead_id: leadId || null }),
    });
    setSubmitting(false);
    if (res.ok) { setTitle(''); setDueDate(''); setLeadId(''); load(); }
  }

  async function toggleComplete(id: number, currentlyDone: boolean) {
    await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: !currentlyDone }) });
    load();
  }

  async function removeTask(id: number) {
    if (!confirm('Delete this task?')) return;
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    load();
  }

  // Categorize open tasks
  const todayStr = new Date().toISOString().split('T')[0];
  const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const overdue: Task[] = [];
  const today: Task[] = [];
  const thisWeek: Task[] = [];
  const later: Task[] = [];
  const noDate: Task[] = [];

  for (const t of tasks) {
    if (!t.due_date) noDate.push(t);
    else if (t.due_date < todayStr) overdue.push(t);
    else if (t.due_date === todayStr) today.push(t);
    else if (t.due_date <= weekFromNow) thisWeek.push(t);
    else later.push(t);
  }

  return (
    <AppShell>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="page-title">Tasks</h1>
          <p className="page-sub">Things you need to do — pick a date, link a lead if it's about one.</p>
        </div>

        {/* Add task form */}
        <form onSubmit={addTask} className="card p-4 mb-6">
          <div className="flex gap-2 flex-wrap">
            <input
              className="input flex-1 min-w-[200px]"
              placeholder="What do you need to do?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
            <input
              type="date"
              className="input w-40"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              title="Due date (optional)"
            />
            <select className="input w-44" value={leadId} onChange={e => setLeadId(e.target.value)} title="Link to lead (optional)">
              <option value="">No lead</option>
              {leads.map((l: any) => <option key={l.id} value={l.id}>{l.company_name}</option>)}
            </select>
            <button type="submit" className="btn-primary" disabled={submitting || !title.trim()}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              Add
            </button>
          </div>
        </form>

        {loading ? (
          <div className="card p-8 animate-pulse h-32 bg-slate-100"/>
        ) : tasks.length === 0 && completed.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-slate-400">No tasks yet — add one above.</p>
          </div>
        ) : (
          <>
            {overdue.length > 0 && <Section title="Overdue" tone="rose" tasks={overdue} onToggle={toggleComplete} onDelete={removeTask}/>}
            {today.length > 0 && <Section title="Today" tone="brand" tasks={today} onToggle={toggleComplete} onDelete={removeTask}/>}
            {thisWeek.length > 0 && <Section title="This Week" tone="amber" tasks={thisWeek} onToggle={toggleComplete} onDelete={removeTask}/>}
            {later.length > 0 && <Section title="Later" tone="slate" tasks={later} onToggle={toggleComplete} onDelete={removeTask}/>}
            {noDate.length > 0 && <Section title="No Date" tone="slate" tasks={noDate} onToggle={toggleComplete} onDelete={removeTask}/>}

            {completed.length > 0 && (
              <div className="mt-6">
                <button onClick={() => setShowCompleted(!showCompleted)} className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1">
                  <svg className={`w-3 h-3 transition-transform ${showCompleted ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                  Completed ({completed.length})
                </button>
                {showCompleted && (
                  <div className="mt-3 space-y-1.5">
                    {completed.map(t => <TaskItem key={t.id} task={t} onToggle={toggleComplete} onDelete={removeTask}/>)}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function Section({ title, tone, tasks, onToggle, onDelete }: { title: string; tone: 'rose'|'brand'|'amber'|'slate'; tasks: Task[]; onToggle: (id: number, done: boolean) => void; onDelete: (id: number) => void }) {
  const toneClasses: Record<string, string> = {
    rose: 'text-rose-700',
    brand: 'text-brand-700',
    amber: 'text-amber-700',
    slate: 'text-slate-600',
  };
  return (
    <div className="mb-5">
      <h2 className={`text-xs font-bold uppercase tracking-wide mb-2 ${toneClasses[tone]}`}>{title} <span className="text-slate-400 font-normal">· {tasks.length}</span></h2>
      <div className="space-y-1.5">
        {tasks.map(t => <TaskItem key={t.id} task={t} onToggle={onToggle} onDelete={onDelete}/>)}
      </div>
    </div>
  );
}

function TaskItem({ task, onToggle, onDelete }: { task: Task; onToggle: (id: number, done: boolean) => void; onDelete: (id: number) => void }) {
  const isDone = !!task.completed_at;
  const todayStr = new Date().toISOString().split('T')[0];
  const overdue = task.due_date && task.due_date < todayStr && !isDone;
  return (
    <div className={`card p-3 flex items-center gap-3 group ${isDone ? 'opacity-60' : ''}`}>
      <button onClick={() => onToggle(task.id, isDone)} className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isDone ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 hover:border-emerald-400'}`}>
        {isDone && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`text-sm ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</div>
        <div className="flex items-center gap-2 mt-0.5">
          {task.due_date && (
            <span className={`text-xs ${overdue ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>
              {formatDate(task.due_date)}
            </span>
          )}
          {task.lead_id && task.lead_name && (
            <Link href={`/leads/${task.lead_id}`} className="text-xs text-brand-600 hover:underline truncate">
              · {task.lead_name}
            </Link>
          )}
        </div>
      </div>
      <button onClick={() => onDelete(task.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-rose-500" title="Delete">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
  );
}
