import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createUpdate, getLeadById, getDb, initSchema } from '@/lib/db';
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as any).role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { lead_id, content, stage_from, stage_to, source, email_date } = await req.json();
  if (!lead_id || !content?.trim()) return NextResponse.json({ error: 'lead_id and content required' }, { status: 400 });
  await initSchema();
  const lead = await getLeadById(Number(lead_id)) as any;
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  if (stage_to && stage_to !== lead.stage) {
    await getDb().execute({ sql: `UPDATE leads SET stage=?,updated_at=NOW() WHERE id=?`, args: [stage_to, lead_id] });
  }
  const userId = (session.user as any).id;
  const id = await createUpdate({ lead_id: Number(lead_id), user_id: userId ? Number(userId) : null, content: content.trim(), stage_from: stage_from||null, stage_to: stage_to||null, source: source||'manual', email_date: email_date||null });
  return NextResponse.json({ id }, { status: 201 });
}
