import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { softDeleteLeads, bulkUpdateLeads, initSchema } from '@/lib/db';
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as any).role;
  if (role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { action, ids, data } = await req.json();
  if (!ids?.length) return NextResponse.json({ error: 'ids required' }, { status: 400 });
  await initSchema();
  if (action === 'delete') {
    if (!['admin','manager'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await softDeleteLeads(ids);
  } else if (action === 'update') {
    await bulkUpdateLeads(ids, data);
  }
  return NextResponse.json({ success: true });
}
