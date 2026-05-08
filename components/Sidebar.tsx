'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { cn, ROLE_CONFIG } from '@/lib/utils';
import { useEffect, useState } from 'react';

const ALL_ROLES = ['admin', 'manager', 'salesman', 'viewer'];
const STAFF = ['admin', 'manager']; // can manage leads of any salesman

const NAV: { href: string; label: string; icon: string; roles: string[]; badge?: boolean }[] = [
  { href: '/my', label: 'Home', roles: ['salesman'], icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/dashboard', label: 'Dashboard', roles: ['admin', 'manager', 'viewer'], icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/my/update', label: 'Submit Update', roles: ['salesman'], icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { href: '/leads', label: 'Leads', roles: ALL_ROLES, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { href: '/parse-email', label: 'Parse Email', roles: STAFF, icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { href: '/calendar', label: 'Calendar', roles: ALL_ROLES, icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { href: '/messages', label: 'Messages', roles: ALL_ROLES, badge: true, icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
  { href: '/trash', label: 'Trash', roles: STAFF, icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
  { href: '/users', label: 'Users', roles: ['admin'], icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { href: '/settings', label: 'Settings', roles: ['admin'], icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const roleCfg = role ? ROLE_CONFIG[role as keyof typeof ROLE_CONFIG] : null;
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetch('/api/messages').then(r => r.json()).then((msgs: any[]) => {
      if (Array.isArray(msgs)) {
        const myId = (session?.user as any)?.id;
        setUnread(msgs.filter(m => m.to_user_id == myId && !m.is_read).length);
      }
    }).catch(() => {});
  }, [pathname, session]);

  return (
    <aside className="w-60 shrink-0 flex flex-col bg-white border-r border-slate-100 min-h-screen">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
          </div>
          <div>
            <div className="font-bold text-slate-900 text-sm">SalesTrack</div>
            <div className="text-xs text-slate-400">Pipeline CRM</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.filter(item => item.roles.includes(role || 'viewer')).map(item => {
          const isActive = item.href === '/my'
            ? pathname === '/my'
            : pathname === item.href || (item.href !== '/leads' && pathname.startsWith(item.href + '/'));
          const isTrash = item.href === '/trash';
          return (
            <Link key={item.href} href={item.href}
              className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? isTrash ? 'bg-rose-600 text-white' : 'bg-brand-600 text-white shadow-sm'
                  : isTrash ? 'text-rose-500 hover:bg-rose-50 hover:text-rose-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={item.icon}/>
              </svg>
              <span className="flex-1">{item.label}</span>
              {item.badge && unread > 0 && (
                <span className="w-5 h-5 bg-rose-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{unread}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-slate-100">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 mb-2">
          <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center text-brand-700 font-bold text-sm shrink-0">
            {session?.user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-800 truncate">{session?.user?.name}</div>
            {roleCfg && <span className={cn('badge text-[10px] mt-0.5', roleCfg.color, roleCfg.bg, roleCfg.border)}>{roleCfg.label}</span>}
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}
