import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTaskById, updateTask, deleteTask, initSchema } from '@/lib/db';

async function checkOwnership(req: NextRequest, id: number) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  if (!userId) return { error: NextResponse.json({ error: 'No user id' }, { status: 400 }) };
  await initSchema();
  const task = await getTaskById(id) as any;
  if (!task) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (task.user_id !== userId) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { task, userId };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const check = await checkOwnership(req, id);
  if ('error' in check) return check.error;
  const body = await req.json();
  const updates: Record<string, any> = {};
  if (typeof body.title === 'string') updates.title = body.title.trim();
  if ('description' in body) updates.description = body.description?.trim() || null;
  if ('due_date' in body) updates.due_date = body.due_date || null;
  if ('lead_id' in body) updates.lead_id = body.lead_id ? Number(body.lead_id) : null;
  if ('completed' in body) {
    updates.completed_at = body.completed ? new Date().toISOString() : null;
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true });
  await updateTask(id, updates);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const check = await checkOwnership(req, id);
  if ('error' in check) return check.error;
  await deleteTask(id);
  return NextResponse.json({ ok: true });
}
