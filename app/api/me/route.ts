import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { initSchema } from '@/lib/db';
import { MANAGER_PERMS, getManagerPerms } from '@/lib/perms';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as any).role;
  await initSchema();

  const perms: Record<string, boolean> = {};
  if (role === 'admin') { for (const k of MANAGER_PERMS) perms[k] = true; }
  else if (role === 'manager') { Object.assign(perms, await getManagerPerms()); }
  else { for (const k of MANAGER_PERMS) perms[k] = false; }

  return NextResponse.json({ role, name: (session.user as any).name || '', perms });
}
