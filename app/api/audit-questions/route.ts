import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllAuditQuestions, createAuditQuestion, initSchema } from '@/lib/db';

function isAdmin(session: any) { return (session?.user as any)?.role === 'admin'; }

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  await initSchema();
  return NextResponse.json(await getAllAuditQuestions());
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const { prompt, options, allow_other } = await req.json();
  if (!prompt?.trim()) return NextResponse.json({ error: 'Question text required' }, { status: 400 });
  await initSchema();
  const opts = Array.isArray(options) ? options.map((o: any) => String(o).trim()).filter(Boolean) : [];
  const id = await createAuditQuestion({ prompt: prompt.trim(), options: opts, allow_other: allow_other !== false });
  return NextResponse.json({ id }, { status: 201 });
}
