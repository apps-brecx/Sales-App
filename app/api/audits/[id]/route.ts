import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { deleteScheduledAudit, setAuditClosed, initSchema } from '@/lib/db';
import { can } from '@/lib/perms';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initSchema();
  if (!(await can((session.user as any)?.role, 'manage_audits'))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const body = await req.json();
  if ('is_closed' in body) await setAuditClosed(Number(params.id), !!body.is_closed);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initSchema();
  if (!(await can((session.user as any)?.role, 'manage_audits'))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  await deleteScheduledAudit(Number(params.id));
  return NextResponse.json({ ok: true });
}
