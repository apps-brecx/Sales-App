import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { deleteUpdate, initSchema } from '@/lib/db';
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin','manager'].includes((session.user as any).role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await initSchema();
  await deleteUpdate(Number(params.id));
  return NextResponse.json({ success: true });
}
