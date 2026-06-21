import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFileById, deleteFile, initSchema } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  const role = (session.user as any).role;
  await initSchema();
  const f: any = await getFileById(Number(params.id));
  if (!f) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (f.scope !== 'shared' && f.owner_id !== userId && role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const buf = Buffer.from(f.data, 'base64');
  return new NextResponse(buf, {
    headers: {
      'Content-Type': f.mime || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${String(f.name).replace(/"/g, '')}"`,
      'Content-Length': String(buf.length),
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id ? Number((session.user as any).id) : null;
  const role = (session.user as any).role;
  await initSchema();
  const f: any = await getFileById(Number(params.id));
  if (!f) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (f.owner_id !== userId && role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await deleteFile(Number(params.id));
  return NextResponse.json({ ok: true });
}
