import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFeatureRequestsForUser, createFeatureRequest, initSchema } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  const role = (session.user as any).role || 'viewer';
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });
  await initSchema();
  return NextResponse.json(await getFeatureRequestsForUser(userId, role));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });
  const { title, description } = await req.json();
  if (!title?.trim() || !description?.trim()) return NextResponse.json({ error: 'title and description required' }, { status: 400 });
  await initSchema();
  const id = await createFeatureRequest({ user_id: userId, title: title.trim(), description: description.trim() });
  return NextResponse.json({ id }, { status: 201 });
}
