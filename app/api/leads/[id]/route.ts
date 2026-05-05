import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getLeadById, getUpdatesByLead, updateLead, softDeleteLead, initSchema } from '@/lib/db';
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initSchema();
  const lead = await getLeadById(Number(params.id));
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ...lead, updates: await getUpdatesByLead(Number(params.id)) });
}
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as any).role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await initSchema();
  await updateLead(Number(params.id), await req.json());
  return NextResponse.json({ success: true });
}
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin','manager'].includes((session.user as any).role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await initSchema();
  await softDeleteLead(Number(params.id));
  return NextResponse.json({ success: true });
}
