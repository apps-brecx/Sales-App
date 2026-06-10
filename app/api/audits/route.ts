import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAuditLeadsForUser, getAuditOverview, upsertAudit, getLeadById, initSchema } from '@/lib/db';
import { getAuditCycle } from '@/lib/utils';

const STAFF = ['admin', 'manager'];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  const role = (session.user as any).role as string;
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });
  await initSchema();

  const cycle = getAuditCycle();
  const { searchParams } = new URL(req.url);
  const isStaff = STAFF.includes(role);

  // Admin/manager: team completion overview for the current cycle.
  if (isStaff && searchParams.get('overview') === '1') {
    return NextResponse.json({ cycle, overview: await getAuditOverview(cycle.start) });
  }

  // Staff can inspect a specific rep's audit entries; reps only see their own.
  const target = searchParams.get('user_id');
  const forUser = isStaff && target ? Number(target) : userId;
  return NextResponse.json({ cycle, leads: await getAuditLeadsForUser(forUser, cycle.start) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  const role = (session.user as any).role as string;
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });

  const cycle = getAuditCycle();
  if (cycle.pending) return NextResponse.json({ error: 'The audit cycle has not started yet' }, { status: 400 });

  const { lead_id, status_text, plan_text } = await req.json();
  if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });
  if (!status_text?.trim() || !plan_text?.trim()) {
    return NextResponse.json({ error: 'Status and plan of action are both required' }, { status: 400 });
  }

  await initSchema();
  const lead = await getLeadById(Number(lead_id));
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  // Reps may only audit leads assigned to them; admin/manager can audit any.
  if (!STAFF.includes(role) && Number(lead.assigned_to) !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await upsertAudit({
    cycle_start: cycle.start,
    lead_id: Number(lead_id),
    user_id: userId,
    status_text: status_text.trim(),
    plan_text: plan_text.trim(),
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
