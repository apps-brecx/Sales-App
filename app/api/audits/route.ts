import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAuditLeadsForUser, getAuditOverview, getActiveAuditQuestions, upsertAudit, getLeadById, initSchema } from '@/lib/db';
import { getAuditCycle } from '@/lib/utils';

const STAFF = ['admin', 'manager'];
const PLAN_STATUSES = ['executed', 'partly', 'not'];

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
  const [questions, leads] = await Promise.all([getActiveAuditQuestions(), getAuditLeadsForUser(forUser, cycle.start)]);
  return NextResponse.json({ cycle, questions, leads });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  const role = (session.user as any).role as string;
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });

  const cycle = getAuditCycle();
  if (cycle.pending) return NextResponse.json({ error: 'The audit cycle has not started yet' }, { status: 400 });

  const { lead_id, answers, plan_text, prev_plan_status, prev_plan_note } = await req.json();
  if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });
  if (!plan_text?.trim()) return NextResponse.json({ error: 'Plan of action is required' }, { status: 400 });

  await initSchema();

  // Every active question must be answered.
  const questions = await getActiveAuditQuestions();
  const ans: Record<string, string> = answers && typeof answers === 'object' ? answers : {};
  const cleanAnswers: Record<string, string> = {};
  for (const q of questions as any[]) {
    const v = String(ans[String(q.id)] ?? '').trim();
    if (!v) return NextResponse.json({ error: `Please answer: ${q.prompt}` }, { status: 400 });
    cleanAnswers[String(q.id)] = v;
  }

  const lead = await getLeadById(Number(lead_id));
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  // Reps may only audit leads assigned to them; admin/manager can audit any.
  if (!STAFF.includes(role) && Number(lead.assigned_to) !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const planStatus = PLAN_STATUSES.includes(prev_plan_status) ? prev_plan_status : null;
  await upsertAudit({
    cycle_start: cycle.start,
    lead_id: Number(lead_id),
    user_id: userId,
    answers: cleanAnswers,
    plan_text: plan_text.trim(),
    prev_plan_status: planStatus,
    prev_plan_note: planStatus && prev_plan_note?.trim() ? prev_plan_note.trim() : null,
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
