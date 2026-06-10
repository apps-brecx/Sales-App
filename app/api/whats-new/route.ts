import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getWhatsNewSeen, setWhatsNewSeen, initSchema } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });
  await initSchema();
  return NextResponse.json({ seen: await getWhatsNewSeen(userId) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });
  const { seen } = await req.json();
  const n = Number(seen);
  if (!Number.isFinite(n)) return NextResponse.json({ error: 'seen must be a number' }, { status: 400 });
  await initSchema();
  await setWhatsNewSeen(userId, Math.max(0, Math.floor(n)));
  return NextResponse.json({ ok: true });
}
