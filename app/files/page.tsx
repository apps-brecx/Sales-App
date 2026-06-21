'use client';
import { useEffect, useRef, useState } from 'react';
import AppShell from '@/components/AppShell';
import { useSession } from 'next-auth/react';
import { timeAgo } from '@/lib/utils';

type FileRow = { id: number; owner_id: number; scope: string; name: string; mime: string | null; size: number | null; created_at: string; owner_name: string | null };

function fmtSize(n: number | null) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function FilesPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const myId = (session?.user as any)?.id;
  const isAdmin = role === 'admin';

  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState('');
  const [error, setError] = useState('');
  const sharedInput = useRef<HTMLInputElement>(null);
  const personalInput = useRef<HTMLInputElement>(null);

  function load() { fetch('/api/files').then(r => r.json()).then(d => { setFiles(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => setLoading(false)); }
  useEffect(load, []);

  async function upload(file: File, scope: 'shared' | 'personal') {
    setError('');
    if (file.size > 10 * 1024 * 1024) { setError('File is too large (max 10 MB).'); return; }
    setUploading(scope);
    const data = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file); });
    const res = await fetch('/api/files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: file.name, mime: file.type, scope, data }) });
    setUploading('');
    if (res.ok) load();
    else { const d = await res.json().catch(() => ({})); setError(d.error || 'Upload failed'); }
  }
  async function remove(id: number) {
    if (!confirm('Delete this file?')) return;
    await fetch(`/api/files/${id}`, { method: 'DELETE' });
    load();
  }

  const shared = files.filter(f => f.scope === 'shared');
  const personal = files.filter(f => f.scope === 'personal');

  return (
    <AppShell>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-6"><h1 className="page-title">Files</h1><p className="page-sub">Shared resources from your team, plus your own private files.</p></div>
        {error && <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">{error}</div>}

        {/* Shared */}
        <div className="card p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><span className="text-lg">📁</span><h2 className="font-semibold text-slate-800">Shared with everyone</h2></div>
            {isAdmin && (
              <>
                <input ref={sharedInput} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f, 'shared'); e.target.value = ''; }} />
                <button onClick={() => sharedInput.current?.click()} className="btn-secondary text-xs" disabled={uploading === 'shared'}>{uploading === 'shared' ? 'Uploading…' : '+ Upload shared file'}</button>
              </>
            )}
          </div>
          <FileList files={shared} loading={loading} canDelete={(f) => isAdmin} onDelete={remove} empty="No shared files yet." />
          {!isAdmin && <p className="text-xs text-slate-400 mt-2">Only an admin can add files here.</p>}
        </div>

        {/* Personal */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><span className="text-lg">🔒</span><h2 className="font-semibold text-slate-800">My files</h2></div>
            {role !== 'viewer' && (
              <>
                <input ref={personalInput} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f, 'personal'); e.target.value = ''; }} />
                <button onClick={() => personalInput.current?.click()} className="btn-secondary text-xs" disabled={uploading === 'personal'}>{uploading === 'personal' ? 'Uploading…' : '+ Upload my file'}</button>
              </>
            )}
          </div>
          <FileList files={personal} loading={loading} canDelete={() => true} onDelete={remove} empty="You haven't uploaded any files." />
        </div>
      </div>
    </AppShell>
  );
}

function FileList({ files, loading, canDelete, onDelete, empty }: { files: FileRow[]; loading: boolean; canDelete: (f: FileRow) => boolean; onDelete: (id: number) => void; empty: string }) {
  if (loading) return <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}</div>;
  if (files.length === 0) return <div className="text-sm text-slate-400 py-4 text-center">{empty}</div>;
  return (
    <div className="divide-y divide-slate-50">
      {files.map(f => (
        <div key={f.id} className="flex items-center gap-3 py-2.5 group">
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-800 truncate">{f.name}</div>
            <div className="text-xs text-slate-400">{fmtSize(f.size)}{f.owner_name ? ` · ${f.owner_name}` : ''} · {timeAgo(f.created_at)}</div>
          </div>
          <a href={`/api/files/${f.id}`} className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-slate-50" title="Download"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg></a>
          {canDelete(f) && <button onClick={() => onDelete(f.id)} className="p-2 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100" title="Delete"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>}
        </div>
      ))}
    </div>
  );
}
