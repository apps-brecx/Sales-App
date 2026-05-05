import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMessages, createMessage, initSchema } from '@/lib/db';
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initSchema();
  const userId = Number((session.user as any).id);
  return NextResponse.json(await getMessages(userId));
}
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { to_user_id, subject, body, lead_id } = await req.json();
  if (!subject?.trim() || !body?.trim()) return NextResponse.json({ error: 'subject and body required' }, { status: 400 });
  await initSchema();
  const id = await createMessage({ from_user_id: Number((session.user as any).id), to_user_id: to_user_id||null, subject, body, lead_id: lead_id||null });
  return NextResponse.json({ id }, { status: 201 });
}
