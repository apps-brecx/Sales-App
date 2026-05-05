import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTrashedLeads, restoreLeads, permanentDeleteLeads, initSchema } from '@/lib/db';
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initSchema();
  return NextResponse.json(await getTrashedLeads());
}
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin','manager'].includes((session.user as any).role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { action, ids } = await req.json();
  await initSchema();
  if (action === 'restore') await restoreLeads(Array.isArray(ids) ? ids : [ids]);
  else if (action === 'permanent_delete') await permanentDeleteLeads(Array.isArray(ids) ? ids : [ids]);
  return NextResponse.json({ success: true });
}
