import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { grabLead, initSchema } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as any).role;
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  if (role === 'viewer' || !userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await initSchema();
  const ok = await grabLead(Number(id), userId);
  if (!ok) return NextResponse.json({ error: 'That lead was already taken' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
