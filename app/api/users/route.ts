import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllUsers, createUser, getUserByEmail, initSchema } from '@/lib/db';
import bcrypt from 'bcryptjs';
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initSchema();
  return NextResponse.json(await getAllUsers());
}
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const { name, email, password, role } = await req.json();
  if (!name || !email || !password) return NextResponse.json({ error: 'name, email, password required' }, { status: 400 });
  await initSchema();
  if (await getUserByEmail(email)) return NextResponse.json({ error: 'Email exists' }, { status: 409 });
  const id = await createUser({ name, email, password_hash: await bcrypt.hash(password, 10), role: role||'salesman' });
  return NextResponse.json({ id }, { status: 201 });
}
