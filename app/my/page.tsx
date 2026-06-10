'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import StageBadge from '@/components/StageBadge';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { STAGE_CONFIG, ALL_STAGES, timeAgo, formatDate } from '@/lib/utils';
import { LeadStage } from '@/types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#f59e0b', '#f97316', '#10b981', '#f43f5e'];

export default function MyHomePage() {
  const { data: session } = useSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState<any>(null);

  function load() {
    fetch('/api/my/home').then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
    fetch('/api/audits').then(r => r.json()).then(setAudit).catch(() => {});
  }
  useEffect(load, []);

  const auditPending = Number(audit?.pending || 0);
  const showAuditBanner = auditPending > 0;

  async function toggleTask(id: number) {
    await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: true }) });
    load();
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = session?.user?.name?.split(' ')[0];
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const winRate = data ? (data.counts.won + data.counts.lost > 0 ? Math.round(data.counts.won / (data.counts.won + data.counts.lost) * 100) : 0) : 0;
  const byStage: Record<string, any[]> = {};
  if (data) {
    for (const s of ALL_STAGES) byStage[s] = [];
    for (const l of (data.active_leads || [])) {
      if (byStage[l.stage]) byStage[l.stage].push(l);
    }
  }
  const pieData = data ? ALL_STAGES.map((s, i) => ({
    name: STAGE_CONFIG[s].label,
    value: Number((data.by_stage || {})[s] || 0),
    color: PIE_COLORS[i],
  })).filter(d => d.value > 0) : [];

  return (
    <AppShell>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-sm text-slate-400 mb-1">{today}</p>
            <h1 className="text-2xl font-bold text-slate-900">{greeting}, {name} 👋</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/my/update" className="btn-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              Submit Update
            </Link>
            <Link href="/leads/new" className="btn-secondary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              Add Lead
            </Link>
          </div>
        </div>

        {showAuditBanner && (
          <Link href="/audit" className="block card p-4 mb-6 border-brand-200 bg-brand-50/40 hover:bg-brand-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800">{auditPending} {auditPending === 1 ? 'lead needs' : 'leads need'} an audit</div>
                <div className="text-xs text-slate-500">Answer the questions and set a plan of action for each.</div>
              </div>
              <svg className="w-5 h-5 text-brand-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </div>
          </Link>
        )}

        {loading ? (
          <div className="grid grid-cols-4 gap-4 mb-6">{[...Array(4)].map((_,i)=><div key={i} className="card p-6 animate-pulse h-28 bg-slate-100"/>)}</div>
        ) : data && (
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <KpiCard label="Active Leads" value={data.counts.active} sub="in your pipeline" color="brand" icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              <KpiCard label="New This Week" value={data.counts.new_this_week} sub="leads added" color="violet" icon="M12 4v16m8-8H4"/>
              <KpiCard label="Won" value={data.counts.won} sub={`${winRate}% win rate`} color="emerald" icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              <KpiCard label="Needs Follow-up" value={data.stale_leads.length} sub="no update 7+ days" color="rose" icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </div>

            {/* New Leads chart + Pipeline Breakdown donut */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
              <div className="card p-6 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-slate-800">New Leads — Last 30 Days</h2>
                </div>
                {data.lead_trend && data.lead_trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={data.lead_trend.map((d: any) => ({ day: d.day?.slice(5), count: Number(d.c) }))}>
                      <defs>
                        <linearGradient id="myLeadGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false}/>
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}/>
                      <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#myLeadGrad)"/>
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No new leads yet — start submitting updates</div>
                )}
              </div>

              <div className="card p-6">
                <h2 className="font-semibold text-slate-800 mb-4">Pipeline Breakdown</h2>
                {pieData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                          {pieData.map((entry, i) => <Cell key={i} fill={entry.color}/>)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}/>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 mt-2">
                      {pieData.map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }}/><span className="text-slate-600">{d.name}</span></div>
                          <span className="font-semibold text-slate-800">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No leads yet</div>
                )}
              </div>
            </div>

            {/* Urgent tasks — today + overdue */}
            {data.urgent_tasks?.length > 0 && (
              <div className="card p-6 mb-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                    </div>
                    <h2 className="font-semibold text-slate-800">Today & Overdue</h2>
                    <span className="badge bg-amber-100 text-amber-700 border-amber-200">{data.urgent_tasks.length}</span>
                  </div>
                  <Link href="/tasks" className="text-xs text-brand-600 hover:underline">View all →</Link>
                </div>
                <div className="space-y-1.5">
                  {data.urgent_tasks.map((t: any) => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const overdue = t.due_date && t.due_date < todayStr;
                    return (
                      <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 group">
                        <button onClick={() => toggleTask(t.id)} className="w-5 h-5 rounded border-2 border-slate-300 hover:border-emerald-400 shrink-0 transition-colors"/>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-800">{t.title}</div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs ${overdue ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>
                              {overdue ? 'Overdue · ' : 'Today · '}{formatDate(t.due_date)}
                            </span>
                            {t.lead_id && t.lead_name && (
                              <Link href={`/leads/${t.lead_id}`} className="text-xs text-brand-600 hover:underline">
                                · {t.lead_name}
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stale leads — urgent */}
            {data.stale_leads.length > 0 && (
              <div className="card p-6 mb-5 border-rose-200 bg-rose-50/30">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    </div>
                    <h2 className="font-semibold text-slate-800">Needs follow-up</h2>
                    <span className="badge bg-rose-100 text-rose-700 border-rose-200">{data.stale_leads.length}</span>
                  </div>
                  <span className="text-xs text-slate-400">no update for 7+ days</span>
                </div>
                <div className="space-y-2">
                  {data.stale_leads.slice(0, 8).map((l: any) => (
                    <Link key={l.id} href={`/leads/${l.id}`} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-rose-100 hover:border-rose-300 hover:shadow-sm transition-all group">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-700 group-hover:text-brand-600 truncate">{l.company_name}</div>
                        {l.contact_name && <div className="text-xs text-slate-400 truncate">{l.contact_name}</div>}
                      </div>
                      <StageBadge stage={l.stage as LeadStage} />
                      <div className="text-xs text-slate-400 w-24 text-right">{timeAgo(l.updated_at)}</div>
                    </Link>
                  ))}
                </div>
                {data.stale_leads.length > 8 && (
                  <div className="mt-3 text-xs text-slate-400 text-center">+{data.stale_leads.length - 8} more</div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
              {/* My pipeline by stage */}
              <div className="card p-6 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-slate-800">My Pipeline</h2>
                  <Link href="/leads" className="text-xs text-brand-600 hover:underline">View all</Link>
                </div>
                {data.active_leads.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-400">No active leads yet — submit an update to log your first one.</div>
                ) : (
                  <div className="space-y-4">
                    {ALL_STAGES.filter(s => byStage[s]?.length > 0 && s !== 'closed_won' && s !== 'closed_lost').map(stage => {
                      const cfg = STAGE_CONFIG[stage];
                      const leads = byStage[stage];
                      return (
                        <div key={stage}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`w-2 h-2 rounded-full ${cfg.dot}`}/>
                            <span className="text-xs font-semibold text-slate-600">{cfg.label}</span>
                            <span className="text-xs text-slate-400">{leads.length}</span>
                          </div>
                          <div className="space-y-1.5">
                            {leads.slice(0, 5).map((l: any) => (
                              <Link key={l.id} href={`/leads/${l.id}`} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors group">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-slate-700 group-hover:text-brand-600 truncate">{l.company_name}</div>
                                  {l.contact_name && <div className="text-xs text-slate-400 truncate">{l.contact_name}</div>}
                                </div>
                                <div className="text-xs text-slate-400">{timeAgo(l.updated_at)}</div>
                              </Link>
                            ))}
                            {leads.length > 5 && <div className="text-xs text-slate-400 pl-3">+{leads.length - 5} more</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Upcoming events */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-slate-800">Upcoming</h2>
                  <Link href="/calendar" className="text-xs text-brand-600 hover:underline">Calendar</Link>
                </div>
                {data.upcoming_events.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">Nothing scheduled</p>
                ) : (
                  <div className="space-y-2">
                    {data.upcoming_events.slice(0, 6).map((e: any) => (
                      <div key={e.id} className="p-3 rounded-xl bg-slate-50">
                        <div className="flex items-start gap-2">
                          <div className="text-center shrink-0 px-2 py-1 bg-white rounded-lg">
                            <div className="text-[10px] font-semibold text-brand-600 uppercase">{new Date(e.event_date).toLocaleDateString('en-US', {month: 'short'})}</div>
                            <div className="text-sm font-bold text-slate-800">{new Date(e.event_date).getDate()}</div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-700 truncate">{e.title}</div>
                            {e.event_time && <div className="text-xs text-slate-400">{e.event_time}</div>}
                            {e.lead_name && <div className="text-xs text-brand-600 truncate">{e.lead_name}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Activity chart + goals */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
              <div className="card p-6 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-slate-800">Your Activity — Last 30 Days</h2>
                </div>
                {data.trend_data && data.trend_data.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={data.trend_data.map((d: any) => ({ day: d.day?.slice(5), count: Number(d.c) }))}>
                      <defs>
                        <linearGradient id="myGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false}/>
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}/>
                      <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#myGrad)"/>
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-44 flex items-center justify-center text-slate-400 text-sm">No activity yet — submit an update to see your trend</div>
                )}
              </div>

              <div className="card p-6">
                <h2 className="font-semibold text-slate-800 mb-4">Pipeline & Goals</h2>
                <div className="space-y-4">
                  <GoalRow label="Pipeline value" value={data.goals?.pipeline_value || 0} sub="active leads"/>
                  <GoalRow label="Weighted forecast" value={data.goals?.weighted_forecast || 0} sub="probability-weighted" tone="violet"/>
                  <GoalRow label="Won this month" value={data.goals?.won_value_this_month || 0} sub={`${data.goals?.won_count_this_month || 0} ${(data.goals?.won_count_this_month || 0) === 1 ? 'deal' : 'deals'}`} tone="emerald"/>
                </div>
              </div>
            </div>

            {/* Recent activity */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-800">Recent Activity on Your Leads</h2>
                <Link href="/leads" className="text-xs text-brand-600 hover:underline">View all</Link>
              </div>
              {data.recent_updates.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No updates yet</p>
              ) : (
                <div className="space-y-3">
                  {data.recent_updates.map((u: any) => (
                    <Link key={u.id} href={`/leads/${u.lead_id}`} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${u.source==='email' ? 'bg-brand-50' : 'bg-slate-100'}`}>
                        {u.source === 'email'
                          ? <svg className="w-3.5 h-3.5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8"/></svg>
                          : <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.83a4 4 0 01-1.897 1.013l-2.796.699.699-2.796A4 4 0 019 13z"/></svg>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-700 truncate group-hover:text-brand-600">{u.company_name}</div>
                        <div className="text-xs text-slate-500 line-clamp-2 mt-0.5">{u.content}</div>
                        <div className="text-xs text-slate-300 mt-0.5">{u.email_date ? formatDate(u.email_date) : timeAgo(u.created_at)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function GoalRow({ label, value, sub, tone = 'brand' }: { label: string; value: number; sub: string; tone?: 'brand'|'violet'|'emerald' }) {
  const tones: Record<string, string> = { brand: 'text-brand-700', violet: 'text-violet-700', emerald: 'text-emerald-700' };
  const fmt = (n: number) => n >= 1000 ? `$${(n/1000).toFixed(n >= 100000 ? 0 : 1)}k` : `$${n.toLocaleString()}`;
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 mb-0.5">{label}</div>
      <div className={`text-2xl font-bold ${tones[tone]}`}>{value > 0 ? fmt(value) : '—'}</div>
      <div className="text-xs text-slate-400">{sub}</div>
    </div>
  );
}

function KpiCard({ label, value, sub, color, icon }: { label: string; value: number; sub: string; color: string; icon: string }) {
  const colors: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600', violet: 'bg-violet-50 text-violet-600',
    emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  const vals: Record<string, string> = {
    brand: 'text-brand-700', violet: 'text-violet-700', emerald: 'text-emerald-700', amber: 'text-amber-700', rose: 'text-rose-700',
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={icon}/></svg>
        </div>
      </div>
      <div className={`text-3xl font-bold mb-1 ${vals[color]}`}>{value}</div>
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
    </div>
  );
}
