import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { deleteScheduledAudit, setAuditClosed, initSchema } from '@/lib/db';

function isAdmin(session: any) { return (session?.user as any)?.role === 'admin'; }

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const body = await req.json();
  await initSchema();
  if ('is_closed' in body) await setAuditClosed(Number(params.id), !!body.is_closed);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  await initSchema();
  await deleteScheduledAudit(Number(params.id));
  return NextResponse.json({ ok: true });
}
