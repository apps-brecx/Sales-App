import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDashboardStats, initSchema } from '@/lib/db';
import { managerLacks } from '@/lib/perms';
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initSchema();
  if (await managerLacks((session.user as any).role, 'access_dashboard')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json(await getDashboardStats());
}
