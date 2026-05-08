// Reconstructs email_submissions records for historical email-sourced lead_updates
// that pre-date the email_submissions table. The original email text isn't recoverable;
// we synthesize an approximation from the parsed update_content of the linked leads.
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
if (!process.env.DATABASE_URL) { console.error('❌ DATABASE_URL not set'); process.exit(1); }

const sql = neon(process.env.DATABASE_URL);

async function main() {
  const groups = await sql(`
    SELECT user_id, email_date, MIN(created_at) as first_at, COUNT(*) as cnt
    FROM lead_updates
    WHERE source='email' AND email_submission_id IS NULL AND user_id IS NOT NULL
    GROUP BY user_id, email_date
    ORDER BY first_at ASC
  `, []);
  console.log(`Found ${groups.length} historical submission group(s) to backfill`);

  for (const g of groups) {
    const updates = await sql(`
      SELECT lu.id as update_id, lu.content, lu.created_at, l.id as lead_id, l.company_name, l.assigned_to
      FROM lead_updates lu
      JOIN leads l ON lu.lead_id=l.id
      WHERE lu.source='email' AND lu.email_submission_id IS NULL
        AND lu.user_id=$1
        AND lu.email_date IS NOT DISTINCT FROM $2
      ORDER BY lu.id ASC
    `, [g.user_id, g.email_date]);

    if (updates.length === 0) continue;

    // Most-common assigned_to among the leads
    const counts = new Map();
    for (const u of updates) {
      const k = u.assigned_to == null ? 'null' : String(u.assigned_to);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    let assignedTo = null;
    let max = 0;
    for (const [k, v] of counts.entries()) {
      if (v > max) { max = v; assignedTo = k === 'null' ? null : Number(k); }
    }

    const emailText =
      `[Reconstructed from ${updates.length} parsed update(s) — original email text not stored]\n\n` +
      updates.map(u => `- ${u.company_name}: ${u.content}`).join('\n');
    const summary = `Historical submission · ${updates.length} ${updates.length === 1 ? 'lead' : 'leads'}`;

    const created = await sql(`
      INSERT INTO email_submissions
        (user_id, assigned_to, email_text, email_date, summary, leads_created, leads_updated, created_at)
      VALUES ($1, $2, $3, $4, $5, 0, $6, $7)
      RETURNING id
    `, [g.user_id, assignedTo, emailText, g.email_date, summary, updates.length, g.first_at]);

    const subId = created[0].id;

    await sql(`
      UPDATE lead_updates
      SET email_submission_id=$1
      WHERE source='email' AND email_submission_id IS NULL
        AND user_id=$2
        AND email_date IS NOT DISTINCT FROM $3
    `, [subId, g.user_id, g.email_date]);

    console.log(`✓ Submission ${subId}: user=${g.user_id} date=${g.email_date || '(none)'} updates=${updates.length} assigned_to=${assignedTo}`);
  }

  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
