import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSubmissionById, initSchema } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initSchema();
  const sub: any = await getSubmissionById(Number(params.id));
  if (!sub) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Salesman can only see their own or ones assigned to them
  const role = (session.user as any).role;
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  const isStaff = role === 'admin' || role === 'manager';
  if (!isStaff && userId && sub.user_id !== userId && sub.assigned_to !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json(sub);
}
