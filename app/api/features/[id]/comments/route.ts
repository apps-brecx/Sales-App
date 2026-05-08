import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { addFeatureRequestComment, getFeatureRequestById, initSchema } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 400 });
  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 });
  await initSchema();
  const requestId = Number(params.id);
  // Salesman can only comment on their own request
  const role = (session.user as any).role;
  const isStaff = role === 'admin' || role === 'manager';
  if (!isStaff) {
    const r: any = await getFeatureRequestById(requestId);
    if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (r.user_id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const id = await addFeatureRequestComment({ request_id: requestId, user_id: userId, content: content.trim() });
  return NextResponse.json({ id }, { status: 201 });
}
