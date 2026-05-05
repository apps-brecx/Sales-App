import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllEvents, createEvent, initSchema } from '@/lib/db';
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initSchema();
  return NextResponse.json(await getAllEvents());
}
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  if (!body.title?.trim() || !body.event_date) return NextResponse.json({ error: 'title and event_date required' }, { status: 400 });
  await initSchema();
  const id = await createEvent({ ...body, user_id: Number((session.user as any).id) });
  return NextResponse.json({ id }, { status: 201 });
}
