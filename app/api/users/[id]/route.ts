import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updateUser, deleteUser, getUserById, initSchema } from '@/lib/db';
import { can } from '@/lib/perms';
import bcrypt from 'bcryptjs';
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initSchema();
  if (!(await can((session.user as any).role, 'manage_users'))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  if (!await getUserById(Number(params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json();
  const updates: any = {};
  if (body.name) updates.name = body.name;
  if (body.email) updates.email = body.email;
  if (body.role) updates.role = body.role;
  if (typeof body.is_active === 'number') updates.is_active = body.is_active;
  if (body.password) updates.password_hash = await bcrypt.hash(body.password, 10);
  await updateUser(Number(params.id), updates);
  return NextResponse.json({ success: true });
}
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initSchema();
  if (!(await can((session.user as any).role, 'manage_users'))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  if (String((session.user as any).id) === params.id) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
  await deleteUser(Number(params.id));
  return NextResponse.json({ success: true });
}
