import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFeatureRequestById, updateFeatureRequestStatus, initSchema } from '@/lib/db';

const VALID_STATUSES = ['open', 'in_progress', 'done', 'declined'];

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initSchema();
  const req = await getFeatureRequestById(Number(params.id)) as any;
  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Salesman can only view their own request
  const role = (session.user as any).role;
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  const isStaff = role === 'admin' || role === 'manager';
  if (!isStaff && userId && req.user_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json(req);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== 'admin' && role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { status } = await req.json();
  if (!VALID_STATUSES.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  await initSchema();
  await updateFeatureRequestStatus(Number(params.id), status);
  return NextResponse.json({ ok: true });
}
