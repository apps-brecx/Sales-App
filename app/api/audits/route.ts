import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getAuditInbox, getScheduledAudits, getScheduledAuditDetail, createScheduledAudit,
  getActiveAuditQuestions, countPendingAuditsForUser, initSchema,
} from '@/lib/db';

const STAFF = ['admin', 'manager'];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  const role = (session.user as any).role as string;
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });
  await initSchema();

  const isStaff = STAFF.includes(role);
  const { searchParams } = new URL(req.url);

  // Admin/manager: list of scheduled audits with completion.
  if (isStaff && searchParams.get('manage') === '1') {
    return NextResponse.json({ audits: await getScheduledAudits() });
  }
  // Admin/manager: full detail of one audit (targets + responses).
  const auditIdParam = searchParams.get('audit_id');
  if (isStaff && auditIdParam) {
    const detail = await getScheduledAuditDetail(Number(auditIdParam));
    const questions = await getActiveAuditQuestions();
    return NextResponse.json({ audit: detail, questions });
  }

  // Default: the current user's audit inbox (paginated). leadId filters to one lead.
  const leadIdParam = searchParams.get('lead_id');
  const leadId = leadIdParam ? Number(leadIdParam) : undefined;
  const page = Math.max(0, Number(searchParams.get('page') || 0));
  const inbox = await getAuditInbox({ userId, isStaff: isStaff && !!leadId, leadId, page });
  const questions = await getActiveAuditQuestions();
  const pending = leadId ? 0 : await countPendingAuditsForUser(userId);
  return NextResponse.json({ ...inbox, pending, questions });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  const role = (session.user as any).role as string;
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });
  if (role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { audit_date, scope, lead_ids, title } = await req.json();
  if (!audit_date || !/^\d{4}-\d{2}-\d{2}$/.test(String(audit_date))) {
    return NextResponse.json({ error: 'A valid audit date is required' }, { status: 400 });
  }
  const useScope: 'all' | 'selected' = scope === 'selected' ? 'selected' : 'all';
  if (useScope === 'selected' && (!Array.isArray(lead_ids) || lead_ids.length === 0)) {
    return NextResponse.json({ error: 'Select at least one lead' }, { status: 400 });
  }
  await initSchema();
  const res = await createScheduledAudit({
    audit_date: String(audit_date), scope: useScope,
    lead_ids: Array.isArray(lead_ids) ? lead_ids : [], created_by: userId,
    title: title?.trim() || null,
  });
  if (res.target_count === 0) return NextResponse.json({ error: 'No active leads to audit' }, { status: 400 });
  return NextResponse.json(res, { status: 201 });
}
