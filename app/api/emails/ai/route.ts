import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEmailThreadFull, initSchema } from '@/lib/db';
import { aiEmail } from '@/lib/emailAi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  const senderName = (session.user as any)?.name || '';
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI is not configured (no API key)' }, { status: 400 });

  const { action, tone, text, thread_id } = await req.json();
  const act = ['draft', 'reply', 'improve', 'shorten'].includes(action) ? action : 'draft';
  if ((act === 'improve' || act === 'shorten') && !text?.trim()) {
    return NextResponse.json({ error: 'Nothing to work with yet — write a little first.' }, { status: 400 });
  }

  await initSchema();
  let thread: any = undefined;
  if (thread_id) {
    const full: any = await getEmailThreadFull(userId, Number(thread_id));
    if (full) thread = {
      subject: full.subject, counterpart: full.counterpart_name || full.counterpart_email,
      leadContext: full.lead_name ? `${full.lead_name} (${full.lead_stage})` : '',
      messages: (full.messages || []).map((m: any) => ({ direction: m.direction, body: m.body_text || '' })),
    };
  }

  try {
    const out = await aiEmail({ action: act, tone, text, thread, senderName });
    return NextResponse.json({ text: out });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'AI request failed' }, { status: 200 });
  }
}
