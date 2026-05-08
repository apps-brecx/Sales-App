import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllLeads, getMyLeads, createLead, initSchema } from '@/lib/db';
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initSchema();
  const role = (session.user as any).role;
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  if (role === 'salesman' && userId) {
    return NextResponse.json(await getMyLeads(userId));
  }
  return NextResponse.json(await getAllLeads());
}
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as any).role;
  if (role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await req.json();
  if (!b.company_name?.trim()) return NextResponse.json({ error: 'company_name required' }, { status: 400 });
  await initSchema();
  // Salesmen can only assign leads to themselves
  const sessionUserId = (session.user as any).id ? Number((session.user as any).id) : null;
  const assigned_to = role === 'salesman' ? sessionUserId : (b.assigned_to ? Number(b.assigned_to) : null);
  const id = await createLead({ ...b, company_name: b.company_name.trim(), assigned_to });
  return NextResponse.json({ id }, { status: 201 });
}
