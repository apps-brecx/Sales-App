'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import QuickLog from './QuickLog';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  useEffect(() => { if (status === 'unauthenticated') router.push('/login'); }, [status, router]);
  if (status === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 bg-brand-600 rounded-xl animate-pulse"/>
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    </div>
  );
  if (!session) return null;
  const role = (session.user as any)?.role;
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
      {role !== 'viewer' && <QuickLog />}
    </div>
  );
}
