import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getLeadById, getUpdatesByLead, updateLead, softDeleteLead, initSchema } from '@/lib/db';
import { managerLacks } from '@/lib/perms';
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
  const role = (session.user as any).role;
  if (!['admin','manager'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await initSchema();
  if (await managerLacks(role, 'delete_leads')) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  await softDeleteLead(Number(params.id));
  return NextResponse.json({ success: true });
}
