import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAuditById, isAuditTarget, getLeadById, getActiveAuditQuestions, upsertAuditResponse, initSchema } from '@/lib/db';

const STAFF = ['admin', 'manager'];
const PLAN_STATUSES = ['executed', 'partly', 'not'];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  const role = (session.user as any).role as string;
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });

  const { audit_id, lead_id, answers, plan_text, prev_plan_status, prev_plan_note } = await req.json();
  if (!audit_id || !lead_id) return NextResponse.json({ error: 'audit_id and lead_id required' }, { status: 400 });
  if (!plan_text?.trim()) return NextResponse.json({ error: 'Plan of action is required' }, { status: 400 });

  await initSchema();
  const audit = await getAuditById(Number(audit_id));
  if (!audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  if (audit.is_closed) return NextResponse.json({ error: 'This audit is closed' }, { status: 400 });
  if (!(await isAuditTarget(Number(audit_id), Number(lead_id)))) {
    return NextResponse.json({ error: 'This lead is not part of that audit' }, { status: 400 });
  }

  const lead = await getLeadById(Number(lead_id));
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  if (!STAFF.includes(role) && Number(lead.assigned_to) !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Every active question must be answered.
  const questions = await getActiveAuditQuestions();
  const ans: Record<string, string> = answers && typeof answers === 'object' ? answers : {};
  const cleanAnswers: Record<string, string> = {};
  for (const q of questions as any[]) {
    const v = String(ans[String(q.id)] ?? '').trim();
    if (!v) return NextResponse.json({ error: `Please answer: ${q.prompt}` }, { status: 400 });
    cleanAnswers[String(q.id)] = v;
  }

  const planStatus = PLAN_STATUSES.includes(prev_plan_status) ? prev_plan_status : null;
  await upsertAuditResponse({
    audit_id: Number(audit_id),
    lead_id: Number(lead_id),
    user_id: userId,
    answers: cleanAnswers,
    plan_text: plan_text.trim(),
    prev_plan_status: planStatus,
    prev_plan_note: planStatus && prev_plan_note?.trim() ? prev_plan_note.trim() : null,
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
