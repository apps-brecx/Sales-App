import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getReferrals, createReferral, getDistributors, initSchema } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  const role = (session.user as any).role;
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });
  await initSchema();
  const distributor = new URL(req.url).searchParams.get('distributor') || undefined;
  const [referrals, distributors] = await Promise.all([getReferrals(userId, role, distributor), getDistributors()]);
  return NextResponse.json({ referrals, distributors });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  const role = (session.user as any).role;
  if (!userId || role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await req.json();
  if (!b.name?.trim()) return NextResponse.json({ error: 'Store name is required' }, { status: 400 });
  await initSchema();
  const assigned_to = role === 'salesman' ? userId : (b.assigned_to ? Number(b.assigned_to) : userId);
  const id = await createReferral({
    name: b.name.trim(), distributor: b.distributor?.trim() || null,
    contact_name: b.contact_name || null, contact_email: b.contact_email || null, contact_phone: b.contact_phone || null,
    status: b.status || 'new', notes: b.notes || null, assigned_to,
  });
  return NextResponse.json({ id }, { status: 201 });
}
