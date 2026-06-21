import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEmailThreadFull, setThreadSummary, initSchema } from '@/lib/db';
import { aiSummary } from '@/lib/emailAi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });
  const { thread_id, refresh } = await req.json();
  if (!thread_id) return NextResponse.json({ error: 'thread_id required' }, { status: 400 });
  await initSchema();

  const full: any = await getEmailThreadFull(userId, Number(thread_id));
  if (!full) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (full.summary && !refresh) return NextResponse.json({ summary: full.summary });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ summary: '' });

  try {
    const summary = await aiSummary({
      subject: full.subject, counterpart: full.counterpart_name || full.counterpart_email,
      leadContext: full.lead_name ? `${full.lead_name} (${full.lead_stage})` : '',
      messages: (full.messages || []).map((m: any) => ({ direction: m.direction, body: m.body_text || '' })),
    });
    if (summary) await setThreadSummary(userId, Number(thread_id), summary);
    return NextResponse.json({ summary });
  } catch (e: any) {
    return NextResponse.json({ summary: '', error: e?.message || 'Summary failed' });
  }
}
