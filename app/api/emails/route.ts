import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getEmailThreads, getEmailThreadFull, getUnreadEmailCount, setThreadFlags, getEmailAccountRaw,
  getSentThreads, getDraftThreads, getScheduledOutbox, initSchema,
} from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });
  await initSchema();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (id) {
    const thread = await getEmailThreadFull(userId, Number(id));
    if (!thread) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (thread.unread) await setThreadFlags(userId, Number(id), { unread: 0 });
    return NextResponse.json({ thread: { ...thread, unread: 0 } });
  }

  const acct: any = await getEmailAccountRaw(userId);
  const tab = searchParams.get('tab') || 'inbox';
  let threads: any[] = [];
  let scheduled: any[] = [];
  if (acct) {
    if (tab === 'sent') threads = await getSentThreads(userId);
    else if (tab === 'drafts') threads = await getDraftThreads(userId);
    else if (tab === 'scheduled') scheduled = await getScheduledOutbox(userId);
    else threads = await getEmailThreads(userId, { tab, search: searchParams.get('search') || '' });
  }

  return NextResponse.json({
    configured: !!acct,
    email_address: acct?.email_address || '',
    last_synced_at: acct?.last_synced_at || null,
    signature: acct?.signature || '',
    include_signature: acct ? acct.include_signature !== 0 : true,
    autopilot_master: !!acct?.autopilot_master,
    autopilot_mode: acct?.autopilot_mode || 'review',
    autopilot_voice: acct?.autopilot_voice || 'Friendly',
    autopilot_hours: acct?.autopilot_hours || 'business',
    autopilot_handback: acct ? acct.autopilot_handback !== 0 : true,
    ooo_enabled: !!acct?.ooo_enabled,
    ooo_subject: acct?.ooo_subject || '',
    ooo_message: acct?.ooo_message || '',
    unread: acct ? await getUnreadEmailCount(userId) : 0,
    threads, scheduled,
  });
}
