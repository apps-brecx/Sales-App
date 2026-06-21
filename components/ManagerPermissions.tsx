'use client';
import { useEffect, useState } from 'react';

const PERMS: [string, string][] = [
  ['see_all_leads', 'See all leads (not just their own)'],
  ['see_team_activity', 'See team activity, notifications & audit overview'],
  ['access_dashboard', 'Access the Dashboard'],
  ['reassign_leads', 'Reassign & bulk-edit leads'],
  ['delete_leads', 'Delete / trash leads'],
  ['import_pool', 'Import leads & manage the pool'],
  ['manage_users', 'Manage users'],
  ['manage_audits', 'Create & manage audits and questions'],
];

export default function ManagerPermissions() {
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      let raw: any = {}; try { raw = JSON.parse(d?.manager_perms || '{}'); } catch {}
      const p: Record<string, boolean> = {};
      for (const [k] of PERMS) p[k] = raw[k] !== false; // default ON
      setPerms(p); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function toggle(k: string) {
    const next = { ...perms, [k]: !perms[k] };
    setPerms(next); setSaving(true); setSaved(false);
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manager_perms: JSON.stringify(next) }) });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-slate-800">Manager permissions</h2>
        {saving ? <span className="text-xs text-slate-400">Saving…</span> : saved ? <span className="text-xs text-emerald-600">Saved</span> : null}
      </div>
      <p className="text-sm text-slate-400 mb-4">What a Manager can do beyond their own salesperson workspace. A manager keeps their personal Sales view and can switch to a Manager view for whatever you allow here.</p>

      {loading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />)}</div> : (
        <div className="divide-y divide-slate-100">
          {PERMS.map(([k, label]) => (
            <div key={k} className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-700">{label}</span>
              <button onClick={() => toggle(k)} className={`relative inline-flex h-6 w-11 rounded-full transition-colors shrink-0 ${perms[k] ? 'bg-brand-600' : 'bg-slate-300'}`}>
                <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform" style={{ transform: perms[k] ? 'translateX(20px)' : 'translateX(0)' }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
