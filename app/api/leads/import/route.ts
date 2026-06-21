import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { bulkCreateLeads, initSchema } from '@/lib/db';
import { managerLacks } from '@/lib/perms';

function parseRows(text: string) {
  return String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(line => {
    const parts = line.split(/\t|,/).map(p => p.trim());
    const [company, contact, email, phone, value] = parts;
    return {
      company_name: company || '',
      contact_name: contact || null,
      contact_email: email && email.includes('@') ? email : null,
      contact_phone: phone || null,
      value: value || null,
    };
  }).filter(r => r.company_name && r.company_name.toLowerCase() !== 'company');
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as any).role;
  if (!['admin', 'manager'].includes(role)) return NextResponse.json({ error: 'Admin or manager only' }, { status: 403 });
  if (await managerLacks(role, 'import_pool')) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const { category, text } = await req.json();
  const rows = parseRows(text);
  if (rows.length === 0) return NextResponse.json({ error: 'No valid lead rows found' }, { status: 400 });
  await initSchema();
  const created = await bulkCreateLeads(rows, category?.trim() || null, 'import');
  return NextResponse.json({ created });
}
