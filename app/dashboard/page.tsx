'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import StageBadge from '@/components/StageBadge';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { STAGE_CONFIG, ALL_STAGES, timeAgo, formatDate } from '@/lib/utils';
import { LeadStage } from '@/types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(d => {
      setStats({
        total_leads: Number(d.total_leads)||0,
        new_this_week: Number(d.new_this_week)||0,
        closed_won: Number(d.closed_won)||0,
        closed_lost: Number(d.closed_lost)||0,
        updates_today: Number(d.updates_today)||0,
        updates_this_week: Number(d.updates_this_week)||0,
        by_stage: d.by_stage||{},
        recent_updates: Array.isArray(d.recent_updates) ? d.recent_updates : [],
        top_salesmen: Array.isArray(d.top_salesmen) ? d.top_salesmen : [],
        trend_data: Array.isArray(d.trend_data) ? d.trend_data : [],
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = session?.user?.name?.split(' ')[0];
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const PIE_COLORS = ['#6366f1','#8b5cf6','#f59e0b','#f97316','#10b981','#f43f5e'];

  const pieData = stats ? ALL_STAGES.map((s, i) => ({
    name: STAGE_CONFIG[s].label,
    value: Number(stats.by_stage[s]||0),
    color: PIE_COLORS[i],
  })).filter(d => d.value > 0) : [];

  const winRate = stats ? (stats.closed_won + stats.closed_lost > 0 ? Math.round(stats.closed_won / (stats.closed_won + stats.closed_lost) * 100) : 0) : 0;

  return (
    <AppShell>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-sm text-slate-400 mb-1">{today}</p>
            <h1 className="text-2xl font-bold text-slate-900">{greeting}, {name} 👋</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/parse-email" className="btn-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              Parse Email
            </Link>
            <Link href="/leads/new" className="btn-secondary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              Add Lead
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-4 gap-4 mb-6">{[...Array(4)].map((_,i)=><div key={i} className="card p-6 animate-pulse h-28 bg-slate-100"/>)}</div>
        ) : stats && (
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <KpiCard label="Total Leads" value={stats.total_leads} sub="in pipeline" color="brand" icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              <KpiCard label="New This Week" value={stats.new_this_week} sub="leads added" color="violet" icon="M12 4v16m8-8H4"/>
              <KpiCard label="Closed Won" value={stats.closed_won} sub={`${winRate}% win rate`} color="emerald" icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              <KpiCard label="Updates Today" value={stats.updates_today} sub={`${stats.updates_this_week} this week`} color="amber" icon="M13 10V3L4 14h7v7l9-11h-7z"/>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
              {/* Trend Chart */}
              <div className="card p-6 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-slate-800">New Leads — Last 30 Days</h2>
                </div>
                {stats.trend_data.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={stats.trend_data.map((d:any) => ({ day: d.day?.slice(5), count: Number(d.c) }))}>
                      <defs>
                        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false}/>
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}/>
                      <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#grad)"/>
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data yet — add some leads to see trends</div>
                )}
              </div>

              {/* Pipeline Pie */}
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
                      {pieData.map((d,i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{background:d.color}}/><span className="text-slate-600">{d.name}</span></div>
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Stage bars */}
              <div className="card p-6 lg:col-span-2">
                <h2 className="font-semibold text-slate-800 mb-4">Stage Overview</h2>
                <div className="space-y-3">
                  {ALL_STAGES.map(stage => {
                    const count = Number(stats.by_stage[stage]||0);
                    const pct = stats.total_leads > 0 ? Math.round(count/stats.total_leads*100) : 0;
                    const cfg = STAGE_CONFIG[stage];
                    return (
                      <div key={stage} className="flex items-center gap-3">
                        <div className="w-28 text-xs font-medium text-slate-600 shrink-0">{cfg.label}</div>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-700 ${cfg.dot}`} style={{width:`${pct}%`}}/>
                        </div>
                        <div className="w-16 text-right text-xs text-slate-500">{count} <span className="text-slate-300">({pct}%)</span></div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100 flex gap-6">
                  <div><div className="text-xs text-slate-400 mb-1">Win Rate</div><div className="text-xl font-bold text-emerald-600">{winRate}%</div></div>
                  <div><div className="text-xs text-slate-400 mb-1">This Week</div><div className="text-xl font-bold text-slate-800">{stats.updates_this_week} updates</div></div>
                  {stats.top_salesmen[0] && <div><div className="text-xs text-slate-400 mb-1">Top Rep</div><div className="text-sm font-bold text-slate-800">{stats.top_salesmen[0].name}</div><div className="text-xs text-slate-400">{Number(stats.top_salesmen[0].update_count)} updates</div></div>}
                </div>
              </div>

              {/* Recent activity */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-slate-800">Recent Activity</h2>
                  <Link href="/leads" className="text-xs text-brand-600 hover:underline">View all</Link>
                </div>
                <div className="space-y-3">
                  {stats.recent_updates.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No activity yet</p>}
                  {stats.recent_updates.slice(0,6).map((u:any) => (
                    <Link key={u.id} href={`/leads/${u.lead_id}`} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${u.source==='email' ? 'bg-brand-50' : 'bg-slate-100'}`}>
                        {u.source === 'email'
                          ? <svg className="w-3.5 h-3.5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8"/></svg>
                          : <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.83a4 4 0 01-1.897 1.013l-2.796.699.699-2.796A4 4 0 019 13z"/></svg>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-700 truncate group-hover:text-brand-600">{u.company_name}</div>
                        <div className="text-xs text-slate-400 line-clamp-1 mt-0.5">{u.content}</div>
                        <div className="text-xs text-slate-300 mt-0.5">{timeAgo(u.created_at)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function KpiCard({ label, value, sub, color, icon }: { label: string; value: number; sub: string; color: string; icon: string }) {
  const colors: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600', violet: 'bg-violet-50 text-violet-600',
    emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600',
  };
  const vals: Record<string, string> = {
    brand: 'text-brand-700', violet: 'text-violet-700', emerald: 'text-emerald-700', amber: 'text-amber-700',
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
