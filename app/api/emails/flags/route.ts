import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { setThreadFlags, upsertEmailAccount, initSchema } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });
  const body = await req.json();
  await initSchema();

  // Per-user account-level flags (autopilot settings, signature).
  if (body.account) {
    const a = body.account;
    const data: Record<string, any> = {};
    if ('autopilot_master' in a) data.autopilot_master = a.autopilot_master ? 1 : 0;
    if ('signature' in a) data.signature = String(a.signature || '') || null;
    if ('include_signature' in a) data.include_signature = a.include_signature ? 1 : 0;
    if ('autopilot_mode' in a) data.autopilot_mode = a.autopilot_mode === 'send' ? 'send' : 'review';
    if ('autopilot_voice' in a) data.autopilot_voice = String(a.autopilot_voice || 'Friendly');
    if ('autopilot_hours' in a) data.autopilot_hours = a.autopilot_hours === 'any' ? 'any' : 'business';
    if ('autopilot_handback' in a) data.autopilot_handback = a.autopilot_handback ? 1 : 0;
    if (Object.keys(data).length) await upsertEmailAccount(userId, data);
    return NextResponse.json({ ok: true });
  }

  // Per-thread flags.
  const threadId = Number(body.thread_id);
  if (!threadId) return NextResponse.json({ error: 'thread_id required' }, { status: 400 });
  const data: Record<string, any> = {};
  for (const k of ['starred', 'archived', 'unread'] as const) if (k in body) data[k] = body[k] ? 1 : 0;
  if ('autopilot' in body) data.autopilot = body.autopilot ? 1 : 0;
  if ('auto_mode' in body) data.auto_mode = body.auto_mode === 'send' ? 'send' : 'review';
  if ('draft_text' in body) data.draft_text = body.draft_text || null;
  if (Object.keys(data).length) await setThreadFlags(userId, threadId, data);
  return NextResponse.json({ ok: true });
}
