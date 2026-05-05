'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role;
  const [settings, setSettings] = useState({ company_name:'', currency:'USD', timezone:'America/New_York', accent_color:'indigo' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (role && role !== 'admin') { router.push('/dashboard'); return; }
    fetch('/api/settings').then(r=>r.json()).then(d=>{ setSettings(s=>({...s,...d})); setLoading(false); });
  }, [role]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch('/api/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(settings) });
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),3000);
  }

  const set = (k: string, v: string) => setSettings(s=>({...s,[k]:v}));

  return (
    <AppShell>
      <div className="p-8 max-w-2xl">
        <div className="mb-8"><h1 className="page-title">Settings</h1><p className="page-sub">Configure your workspace</p></div>

        {saved && <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
          Settings saved
        </div>}

        {loading ? <div className="card p-6 animate-pulse space-y-4">{[...Array(4)].map((_,i)=><div key={i} className="h-10 bg-slate-100 rounded-xl"/>)}</div> : (
          <form onSubmit={save} className="space-y-5">
            <div className="card p-6 space-y-4">
              <h2 className="font-semibold text-slate-800 mb-1">General</h2>
              <div><label className="label">Company Name</label><input className="input" value={settings.company_name} onChange={e=>set('company_name',e.target.value)} placeholder="My Company"/></div>
            </div>

            <div className="card p-6 space-y-4">
              <h2 className="font-semibold text-slate-800 mb-1">Preferences</h2>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Currency</label>
                  <select className="input" value={settings.currency} onChange={e=>set('currency',e.target.value)}>
                    {[['USD','US Dollar'],['EUR','Euro'],['GBP','British Pound'],['CAD','Canadian Dollar'],['ILS','Israeli Shekel'],['AUD','Australian Dollar']].map(([v,l])=><option key={v} value={v}>{v} — {l}</option>)}
                  </select>
                </div>
                <div><label className="label">Timezone</label>
                  <select className="input" value={settings.timezone} onChange={e=>set('timezone',e.target.value)}>
                    {[['America/New_York','Eastern (ET)'],['America/Chicago','Central (CT)'],['America/Los_Angeles','Pacific (PT)'],['Europe/London','London (GMT)'],['Europe/Paris','Paris (CET)'],['Asia/Jerusalem','Jerusalem (IST)'],['Asia/Dubai','Dubai (GST)']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <h2 className="font-semibold text-slate-800 mb-4">App Info</h2>
              <div className="space-y-2">
                {[['Version','2.0.0'],['Database','SQLite (local)'],['AI Model','Claude Sonnet'],['Framework','Next.js 14']].map(([k,v])=>(
                  <div key={k} className="flex justify-between py-2 border-b border-slate-100 last:border-0">
                    <span className="text-sm text-slate-500">{k}</span>
                    <span className="text-sm font-semibold text-slate-700">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-6 border-rose-100">
              <h2 className="font-semibold text-rose-700 mb-2">Danger Zone</h2>
              <p className="text-sm text-slate-400 mb-4">These actions are irreversible.</p>
              <button type="button" onClick={async()=>{ if(confirm('Empty all trashed leads permanently?')) { await fetch('/api/trash',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'permanent_delete',ids:[]})}); }}} className="btn-danger text-xs">Empty Trash</button>
            </div>

            <button type="submit" className="btn-primary" disabled={saving}>
              {saving && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
