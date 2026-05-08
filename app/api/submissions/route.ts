import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSubmissionsForUser, initSchema } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  const role = (session.user as any).role || 'viewer';
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });
  await initSchema();
  return NextResponse.json(await getSubmissionsForUser(userId, role));
}
