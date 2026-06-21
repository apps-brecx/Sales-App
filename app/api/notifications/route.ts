import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getNotifications, getUnreadNotificationCount, markNotificationsRead, initSchema } from '@/lib/db';
import { managerLacks } from '@/lib/perms';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== 'admin' && role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (await managerLacks(role, 'see_team_activity')) return NextResponse.json({ list: [], unread: 0 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });
  await initSchema();
  const [list, unread] = await Promise.all([
    getNotifications(userId),
    getUnreadNotificationCount(userId),
  ]);
  return NextResponse.json({ list, unread });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== 'admin' && role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });
  await initSchema();
  await markNotificationsRead(userId);
  return NextResponse.json({ ok: true });
}
