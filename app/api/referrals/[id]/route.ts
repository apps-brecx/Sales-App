import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getReferralById, updateReferral, softDeleteReferral, initSchema } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initSchema();
  const r = await getReferralById(Number(params.id));
  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(r);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as any).role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await initSchema();
  const body = await req.json();
  const allowed = ['name', 'distributor', 'contact_name', 'contact_email', 'contact_phone', 'status', 'notes', 'assigned_to'];
  const data: Record<string, any> = {};
  for (const k of allowed) if (k in body) data[k] = body[k] === '' ? null : body[k];
  await updateReferral(Number(params.id), data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'manager', 'salesman'].includes((session.user as any).role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await initSchema();
  await softDeleteReferral(Number(params.id));
  return NextResponse.json({ ok: true });
}
