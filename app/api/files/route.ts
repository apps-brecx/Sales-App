import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFilesForUser, createFile, initSchema } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });
  await initSchema();
  return NextResponse.json(await getFilesForUser(userId));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  const role = (session.user as any).role;
  if (!userId || role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, mime, scope, data } = await req.json();
  if (!name?.trim() || !data) return NextResponse.json({ error: 'Missing file name or data' }, { status: 400 });
  const useScope = scope === 'shared' ? 'shared' : 'personal';
  if (useScope === 'shared' && role !== 'admin') return NextResponse.json({ error: 'Only an admin can share files with everyone' }, { status: 403 });

  const b64 = String(data).includes(',') ? String(data).split(',').pop()! : String(data);
  const size = Math.floor(b64.length * 0.75);
  if (size > MAX_BYTES) return NextResponse.json({ error: 'File is too large (max 10 MB)' }, { status: 400 });

  await initSchema();
  const id = await createFile({ owner_id: userId, scope: useScope, name: name.trim(), mime: mime || null, size, data: b64 });
  return NextResponse.json({ id }, { status: 201 });
}
