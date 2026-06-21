import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { addReferralUpdate, initSchema } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  if (!userId || (session.user as any).role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { content, status_from, status_to } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: 'Update text is required' }, { status: 400 });
  await initSchema();
  const id = await addReferralUpdate({ referral_id: Number(params.id), user_id: userId, content: content.trim(), status_from: status_from || null, status_to: status_to || null });
  return NextResponse.json({ id }, { status: 201 });
}
