import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTasksForUser, createTask, initSchema } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });
  await initSchema();
  const { searchParams } = new URL(req.url);
  const includeCompleted = searchParams.get('completed') === 'true';
  const leadIdParam = searchParams.get('lead_id');
  const leadId = leadIdParam ? Number(leadIdParam) : undefined;
  return NextResponse.json(await getTasksForUser(userId, { includeCompleted, leadId }));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });
  const { title, description, due_date, lead_id } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 });
  await initSchema();
  const id = await createTask({
    user_id: userId,
    title: title.trim(),
    description: description?.trim() || null,
    due_date: due_date || null,
    lead_id: lead_id ? Number(lead_id) : null,
  });
  return NextResponse.json({ id }, { status: 201 });
}
