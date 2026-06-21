import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updateAuditQuestion, deleteAuditQuestion, initSchema } from '@/lib/db';
import { can } from '@/lib/perms';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initSchema();
  if (!(await can((session.user as any)?.role, 'manage_audits'))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const body = await req.json();
  const patch: any = {};
  if (body.prompt !== undefined) patch.prompt = String(body.prompt).trim();
  if (body.options !== undefined) patch.options = Array.isArray(body.options) ? body.options.map((o: any) => String(o).trim()).filter(Boolean) : [];
  if (body.allow_other !== undefined) patch.allow_other = !!body.allow_other;
  if (body.is_active !== undefined) patch.is_active = !!body.is_active;
  if (patch.prompt !== undefined && !patch.prompt) return NextResponse.json({ error: 'Question text required' }, { status: 400 });
  await updateAuditQuestion(Number(params.id), patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initSchema();
  if (!(await can((session.user as any)?.role, 'manage_audits'))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  await deleteAuditQuestion(Number(params.id));
  return NextResponse.json({ ok: true });
}
