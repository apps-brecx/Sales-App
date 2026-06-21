import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllSettings, setSetting, renameLeadCategory, initSchema } from '@/lib/db';

function parseList(s: any): string[] { try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } }

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  await initSchema();
  const { action, name, from, to } = await req.json();
  const settings = await getAllSettings();
  let list = parseList(settings.lead_categories);

  if (action === 'add') {
    const v = String(name || '').trim();
    if (v && !list.includes(v)) list.push(v);
  } else if (action === 'remove') {
    list = list.filter(c => c !== name);
  } else if (action === 'rename') {
    const f = String(from || '').trim(), t = String(to || '').trim();
    if (!t) return NextResponse.json({ error: 'New name required' }, { status: 400 });
    list = list.map(c => (c === f ? t : c));
    await renameLeadCategory(f, t); // migrate existing leads
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  await setSetting('lead_categories', JSON.stringify(list));
  return NextResponse.json({ ok: true, list });
}
