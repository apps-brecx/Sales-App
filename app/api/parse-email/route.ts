import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';
import { getAllLeads, findLeadByCompany, createLead, createUpdate, getLeadById, getDb, initSchema, createSubmission, updateSubmissionResults } from '@/lib/db';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as any).role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json();
  const { email_text, email_date } = body;
  if (!email_text?.trim()) return NextResponse.json({ error: 'email_text required' }, { status: 400 });
  const role = (session.user as any).role;
  const sessionUserId = (session.user as any).id ? Number((session.user as any).id) : null;
  // Salesmen always assign to themselves; admin/manager can pick anyone
  const assigned_to = role === 'salesman' ? sessionUserId : body.assigned_to;
  await initSchema();
  const existing = (await getAllLeads() as any[]).map((l: any) => l.company_name);
  const system = `You are a CRM assistant extracting sales leads from salesman emails.
Existing leads: ${existing.length ? existing.join(', ') : 'none'}.
For each lead/prospect mentioned return:
- company_name (required), contact_name, contact_email, contact_phone
- stage: new|contacted|follow_up|proposal|closed_won|closed_lost
- update_content: what happened with this lead (required)
- is_new_lead: true if not in existing leads list
Also: summary (1-2 sentences), email_date (YYYY-MM-DD).
Respond ONLY with valid JSON: {"leads":[...],"summary":"...","email_date":"YYYY-MM-DD"}`;
  try {
    const res = await anthropic.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 2000, system, messages: [{ role: 'user', content: email_text }] });
    const raw = res.content[0].type === 'text' ? res.content[0].text : '';
    let parsed;
    try { parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()); }
    catch { return NextResponse.json({ error: 'Failed to parse AI response', raw }, { status: 500 }); }
    const userId = (session.user as any).id ? Number((session.user as any).id) : null;
    const backdateAt: string | null = email_date || parsed.email_date || null;

    // Log the submission so we can show history later
    let submissionId: number | null = null;
    if (userId) {
      const subId = await createSubmission({ user_id: userId, assigned_to: assigned_to ?? null, email_text, email_date: backdateAt, summary: parsed.summary ?? null });
      submissionId = subId ? Number(subId) : null;
    }

    const results = [];
    for (const item of parsed.leads) {
      if (!item.company_name) continue;
      let lead = await findLeadByCompany(item.company_name) as any;
      let isNew = false;
      if (!lead) {
        const id = await createLead({ company_name: item.company_name, contact_name: item.contact_name||null, contact_email: item.contact_email||null, contact_phone: item.contact_phone||null, stage: item.stage||'new', assigned_to: assigned_to||null, source: 'email', created_at: backdateAt });
        lead = await getLeadById(Number(id));
        isNew = true;
      } else {
        const upd: any = {};
        if (!lead.contact_name && item.contact_name) upd.contact_name = item.contact_name;
        if (!lead.contact_email && item.contact_email) upd.contact_email = item.contact_email;
        if (!lead.contact_phone && item.contact_phone) upd.contact_phone = item.contact_phone;
        if (item.stage && item.stage !== lead.stage) upd.stage = item.stage;
        if (Object.keys(upd).length) {
          const keys = Object.keys(upd);
          const updatedAtClause = backdateAt ? `,updated_at=GREATEST(updated_at, ?::timestamptz)` : `,updated_at=NOW()`;
          const updArgs = [...keys.map(k=>upd[k]), ...(backdateAt ? [backdateAt] : []), lead.id];
          await getDb().execute({ sql: `UPDATE leads SET ${keys.map(k=>`${k}=?`).join(',')}${updatedAtClause} WHERE id=?`, args: updArgs });
        }
      }
      const uid = await createUpdate({ lead_id: Number(lead.id), user_id: userId, content: item.update_content, stage_from: isNew ? null : lead.stage as string, stage_to: item.stage||lead.stage as string, source: 'email', email_date: backdateAt, created_at: backdateAt, email_submission_id: submissionId });
      results.push({ lead_id: Number(lead.id), company_name: item.company_name, is_new: isNew, update_id: Number(uid) });
    }

    const leadsCreated = results.filter(r=>r.is_new).length;
    const leadsUpdated = results.filter(r=>!r.is_new).length;
    if (submissionId) await updateSubmissionResults(submissionId, parsed.summary ?? null, leadsCreated, leadsUpdated);

    return NextResponse.json({ success: true, submission_id: submissionId, summary: parsed.summary, email_date: parsed.email_date, results, leads_created: leadsCreated, leads_updated: leadsUpdated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message||'Unknown error' }, { status: 500 });
  }
}
