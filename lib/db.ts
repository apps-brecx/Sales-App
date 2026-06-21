import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let sqlClient: NeonQueryFunction<false, false> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (!sqlClient) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    sqlClient = neon(process.env.DATABASE_URL);
  }
  return sqlClient;
}

type ExecArg = string | { sql: string; args?: any[] };
type ExecResult = { rows: any[]; lastInsertRowid?: any };

export function getDb() {
  return {
    async execute(arg: ExecArg): Promise<ExecResult> {
      const s = getSql();
      const text = typeof arg === 'string' ? arg : arg.sql;
      const params = typeof arg === 'string' ? [] : (arg.args ?? []);
      let i = 0;
      const pgText = text.replace(/\?/g, () => `$${++i}`);
      const rows = (await s(pgText, params)) as any[];
      return { rows, lastInsertRowid: rows[0]?.id };
    },
    async executeMultiple(text: string): Promise<void> {
      const s = getSql();
      const stmts = text.split(';').map(x => x.trim()).filter(Boolean);
      for (const stmt of stmts) await s(stmt, []);
    },
  };
}

let schemaInitialized = false;

export async function initSchema() {
  if (schemaInitialized) return;
  const db = getDb();
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'salesman',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      company_name TEXT NOT NULL, contact_name TEXT, contact_email TEXT, contact_phone TEXT,
      stage TEXT NOT NULL DEFAULT 'new', assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      source TEXT NOT NULL DEFAULT 'manual', notes TEXT, value TEXT DEFAULT NULL,
      deleted_at TIMESTAMPTZ DEFAULT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS lead_updates (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      content TEXT NOT NULL, stage_from TEXT, stage_to TEXT,
      source TEXT NOT NULL DEFAULT 'manual', email_date TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      subject TEXT NOT NULL, body TEXT NOT NULL,
      lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
      title TEXT NOT NULL, description TEXT,
      event_date TEXT NOT NULL, event_time TEXT,
      type TEXT NOT NULL DEFAULT 'Meeting',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY, value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_submissions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      email_text TEXT NOT NULL,
      email_date TEXT,
      summary TEXT,
      leads_created INTEGER NOT NULL DEFAULT 0,
      leads_updated INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS feature_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS feature_request_comments (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS lead_audits (
      id SERIAL PRIMARY KEY,
      cycle_start TEXT NOT NULL,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status_text TEXT,
      plan_text TEXT NOT NULL,
      answers TEXT,
      prev_plan_status TEXT,
      prev_plan_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (cycle_start, lead_id)
    );

    CREATE TABLE IF NOT EXISTS audit_questions (
      id SERIAL PRIMARY KEY,
      prompt TEXT NOT NULL,
      options TEXT NOT NULL DEFAULT '[]',
      allow_other INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audits (
      id SERIAL PRIMARY KEY,
      title TEXT,
      audit_date TEXT NOT NULL,
      period_start TEXT,
      scope TEXT NOT NULL DEFAULT 'all',
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      is_closed INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_targets (
      id SERIAL PRIMARY KEY,
      audit_id INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      UNIQUE (audit_id, lead_id)
    );

    CREATE TABLE IF NOT EXISTS audit_responses (
      id SERIAL PRIMARY KEY,
      audit_id INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      answers TEXT,
      plan_text TEXT NOT NULL,
      prev_plan_status TEXT,
      prev_plan_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (audit_id, lead_id)
    );

    CREATE TABLE IF NOT EXISTS email_accounts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      account_name TEXT,
      email_address TEXT NOT NULL,
      imap_host TEXT, imap_port INTEGER DEFAULT 993, imap_username TEXT,
      imap_password_enc TEXT, imap_folder TEXT DEFAULT 'INBOX', imap_secure INTEGER DEFAULT 1,
      smtp_host TEXT, smtp_port INTEGER DEFAULT 587, smtp_username TEXT, smtp_password_enc TEXT,
      reply_from TEXT,
      last_synced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS email_threads (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      thread_key TEXT NOT NULL,
      lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
      counterpart_name TEXT, counterpart_email TEXT,
      subject TEXT,
      last_message_at TIMESTAMPTZ,
      last_snippet TEXT,
      unread INTEGER NOT NULL DEFAULT 0,
      starred INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      autopilot INTEGER NOT NULL DEFAULT 0,
      auto_mode TEXT NOT NULL DEFAULT 'review',
      draft_text TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, thread_key)
    );

    CREATE TABLE IF NOT EXISTS email_messages (
      id SERIAL PRIMARY KEY,
      thread_id INTEGER NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      direction TEXT NOT NULL,
      from_addr TEXT, from_name TEXT, to_addr TEXT,
      subject TEXT, body_text TEXT,
      message_id TEXT, in_reply_to TEXT,
      imap_uid INTEGER, sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS email_outbox (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      thread_id INTEGER REFERENCES email_threads(id) ON DELETE SET NULL,
      to_addr TEXT NOT NULL,
      subject TEXT, body TEXT NOT NULL,
      send_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
    CREATE INDEX IF NOT EXISTS idx_leads_deleted ON leads(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_updates_lead ON lead_updates(lead_id);
    CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_user_id);
    CREATE INDEX IF NOT EXISTS idx_events_date ON calendar_events(event_date);
    CREATE INDEX IF NOT EXISTS idx_submissions_user ON email_submissions(user_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_assigned ON email_submissions(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_features_user ON feature_requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_feature_comments_req ON feature_request_comments(request_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_lead ON tasks(lead_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_audits_cycle ON lead_audits(cycle_start);
    CREATE INDEX IF NOT EXISTS idx_audits_lead ON lead_audits(lead_id);
    CREATE INDEX IF NOT EXISTS idx_audit_targets_audit ON audit_targets(audit_id);
    CREATE INDEX IF NOT EXISTS idx_audit_targets_lead ON audit_targets(lead_id);
    CREATE INDEX IF NOT EXISTS idx_audit_responses_audit ON audit_responses(audit_id);
    CREATE INDEX IF NOT EXISTS idx_audit_responses_lead ON audit_responses(lead_id);
    CREATE INDEX IF NOT EXISTS idx_email_threads_user ON email_threads(user_id, last_message_at);
    CREATE INDEX IF NOT EXISTS idx_email_messages_thread ON email_messages(thread_id);
    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      scope TEXT NOT NULL DEFAULT 'personal',
      name TEXT NOT NULL,
      mime TEXT, size INTEGER,
      data TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_files_scope ON files(scope);
    CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id)
  `);

  for (const col of ['deleted_at TIMESTAMPTZ DEFAULT NULL', 'value TEXT DEFAULT NULL', 'tags TEXT DEFAULT NULL', 'next_action TEXT DEFAULT NULL', 'next_action_due TEXT DEFAULT NULL', 'expected_close TEXT DEFAULT NULL', 'category TEXT DEFAULT NULL']) {
    const colName = col.split(' ')[0];
    try { await db.execute(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS ${col}`); } catch {}
  }
  try { await db.execute(`ALTER TABLE lead_updates ADD COLUMN IF NOT EXISTS email_submission_id INTEGER REFERENCES email_submissions(id) ON DELETE SET NULL`); } catch {}
  for (const col of ['last_login_at TIMESTAMPTZ DEFAULT NULL', 'login_count INTEGER NOT NULL DEFAULT 0', 'notifications_seen_at TIMESTAMPTZ DEFAULT NOW()', 'whats_new_seen INTEGER NOT NULL DEFAULT 0']) {
    try { await db.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col}`); } catch {}
  }
  // Audit answers + plan-execution tracking (added after lead_audits shipped)
  for (const col of ['answers TEXT', 'prev_plan_status TEXT', 'prev_plan_note TEXT']) {
    try { await db.execute(`ALTER TABLE lead_audits ADD COLUMN IF NOT EXISTS ${col}`); } catch {}
  }
  try { await db.execute(`ALTER TABLE lead_audits ALTER COLUMN status_text DROP NOT NULL`); } catch {}
  for (const col of ['signature TEXT', 'autopilot_master INTEGER NOT NULL DEFAULT 0', 'include_signature INTEGER NOT NULL DEFAULT 1', "autopilot_mode TEXT DEFAULT 'review'", "autopilot_voice TEXT DEFAULT 'Friendly'", "autopilot_hours TEXT DEFAULT 'business'", 'autopilot_handback INTEGER NOT NULL DEFAULT 1']) {
    try { await db.execute(`ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS ${col}`); } catch {}
  }
  try { await db.execute(`ALTER TABLE email_threads ADD COLUMN IF NOT EXISTS summary TEXT`); } catch {}

  const defaults = [
    ['company_name', 'My Company'], ['currency', 'USD'],
    ['timezone', 'America/New_York'], ['accent_color', 'indigo'],
    ['next_action_presets', JSON.stringify(['Call to follow up', 'Send proposal', 'Send a quote', 'Schedule a meeting', 'Negotiate terms', 'Send samples', 'Wait for their reply', 'Check in'])],
    ['lead_categories', JSON.stringify(['National Stores', 'National Distributors', 'Local'])],
  ];
  for (const [k, v] of defaults) {
    await db.execute({ sql: `INSERT INTO app_settings (key,value) VALUES (?,?) ON CONFLICT (key) DO NOTHING`, args: [k, v] });
  }

  // Seed a starter set of audit questions once, so the feature works out of the box.
  const seeded = await db.execute(`SELECT value FROM app_settings WHERE key='audit_questions_seeded'`);
  if (seeded.rows.length === 0) {
    const existing = await db.execute(`SELECT COUNT(*)::int as c FROM audit_questions`);
    if (Number((existing.rows[0] as any)?.c || 0) === 0) {
      const starter = [
        { prompt: 'How likely is this lead to close?', options: ['Very likely', 'Likely', 'Uncertain', 'Unlikely'] },
        { prompt: 'When did you last make contact?', options: ['This week', '1–2 weeks ago', '2–4 weeks ago', 'Over a month ago'] },
        { prompt: "What's the main blocker right now?", options: ['Price', 'Timing', 'Decision maker', 'Competitor', 'No blocker'] },
      ];
      let i = 0;
      for (const q of starter) {
        await db.execute({ sql: `INSERT INTO audit_questions (prompt,options,allow_other,sort_order) VALUES (?,?,1,?)`, args: [q.prompt, JSON.stringify(q.options), i++] });
      }
    }
    await db.execute({ sql: `INSERT INTO app_settings (key,value) VALUES ('audit_questions_seeded','1') ON CONFLICT (key) DO NOTHING`, args: [] });
  }

  schemaInitialized = true;
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export async function getAllSettings() {
  const db = getDb();
  const r = await db.execute(`SELECT key, value FROM app_settings`);
  const out: Record<string, string> = {};
  r.rows.forEach((row: any) => { out[row.key] = row.value; });
  return out;
}
export async function setSetting(key: string, value: string) {
  await getDb().execute({ sql: `INSERT INTO app_settings (key,value) VALUES (?,?) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, args: [key, value] });
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function getAllUsers() {
  return (await getDb().execute(`SELECT id,name,email,role,is_active,created_at,last_login_at,login_count FROM users ORDER BY name`)).rows;
}
export async function recordLogin(userId: number) {
  await getDb().execute({ sql: `UPDATE users SET last_login_at=NOW(),login_count=login_count+1 WHERE id=?`, args: [userId] });
}
export async function getWhatsNewSeen(userId: number) {
  const r = await getDb().execute({ sql: `SELECT whats_new_seen FROM users WHERE id=?`, args: [userId] });
  return Number((r.rows[0] as any)?.whats_new_seen || 0);
}
export async function setWhatsNewSeen(userId: number, n: number) {
  await getDb().execute({ sql: `UPDATE users SET whats_new_seen=GREATEST(COALESCE(whats_new_seen,0), ?) WHERE id=?`, args: [n, userId] });
}
export async function getNotifications(forUserId: number, limit = 100) {
  return (await getDb().execute({ sql: `
    SELECT lu.id, lu.lead_id, lu.user_id, lu.content, lu.source, lu.created_at, lu.email_date,
           lu.email_submission_id,
           l.company_name, l.stage,
           u.name as user_name, u.role as user_role,
           (SELECT notifications_seen_at FROM users WHERE id=?) as seen_at
    FROM lead_updates lu
    JOIN leads l ON lu.lead_id=l.id
    LEFT JOIN users u ON lu.user_id=u.id
    WHERE lu.user_id IS NOT NULL AND lu.user_id != ?
    ORDER BY lu.created_at DESC LIMIT ?
  `, args: [forUserId, forUserId, limit] })).rows;
}
export async function getUnreadNotificationCount(forUserId: number) {
  const r = await getDb().execute({ sql: `
    SELECT COUNT(*)::int as c FROM lead_updates lu
    WHERE lu.user_id IS NOT NULL AND lu.user_id != ?
      AND lu.created_at > COALESCE((SELECT notifications_seen_at FROM users WHERE id=?), '1970-01-01'::timestamptz)
  `, args: [forUserId, forUserId] });
  return Number((r.rows[0] as any)?.c || 0);
}
export async function markNotificationsRead(userId: number) {
  await getDb().execute({ sql: `UPDATE users SET notifications_seen_at=NOW() WHERE id=?`, args: [userId] });
}
export async function getUserByEmail(email: string) {
  return (await getDb().execute({ sql: `SELECT * FROM users WHERE email=?`, args: [email] })).rows[0] || null;
}
export async function getUserById(id: number) {
  return (await getDb().execute({ sql: `SELECT id,name,email,role,is_active,created_at FROM users WHERE id=?`, args: [id] })).rows[0] || null;
}
export async function createUser(d: { name: string; email: string; password_hash: string; role: string }) {
  return (await getDb().execute({ sql: `INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?) RETURNING id`, args: [d.name, d.email, d.password_hash, d.role] })).lastInsertRowid;
}
export async function updateUser(id: number, data: Record<string, any>) {
  const keys = Object.keys(data);
  await getDb().execute({ sql: `UPDATE users SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`, args: [...keys.map(k => data[k]), id] });
}
export async function deleteUser(id: number) {
  await getDb().execute({ sql: `DELETE FROM users WHERE id=?`, args: [id] });
}

// ─── Leads ────────────────────────────────────────────────────────────────────
export async function getAllLeads() {
  return (await getDb().execute(`
    SELECT l.*,u.name as assigned_name,COUNT(lu.id) as update_count,MAX(lu.created_at) as last_update
    FROM leads l LEFT JOIN users u ON l.assigned_to=u.id
    LEFT JOIN lead_updates lu ON l.id=lu.lead_id
    WHERE l.deleted_at IS NULL GROUP BY l.id, u.name ORDER BY l.updated_at DESC
  `)).rows;
}
export async function getTrashedLeads() {
  return (await getDb().execute(`
    SELECT l.*,u.name as assigned_name,COUNT(lu.id) as update_count
    FROM leads l LEFT JOIN users u ON l.assigned_to=u.id
    LEFT JOIN lead_updates lu ON l.id=lu.lead_id
    WHERE l.deleted_at IS NOT NULL GROUP BY l.id, u.name ORDER BY l.deleted_at DESC
  `)).rows;
}
export async function getLeadById(id: number) {
  return (await getDb().execute({ sql: `SELECT l.*,u.name as assigned_name FROM leads l LEFT JOIN users u ON l.assigned_to=u.id WHERE l.id=?`, args: [id] })).rows[0] || null;
}
export async function findLeadByCompany(company: string) {
  return (await getDb().execute({ sql: `SELECT * FROM leads WHERE LOWER(TRIM(company_name))=LOWER(TRIM(?)) AND deleted_at IS NULL`, args: [company] })).rows[0] || null;
}
export async function createLead(d: { company_name: string; contact_name?: string|null; contact_email?: string|null; contact_phone?: string|null; stage?: string; assigned_to?: number|null; source?: string; notes?: string|null; value?: string|null; category?: string|null; created_at?: string|null }) {
  const baseArgs = [d.company_name, d.contact_name??null, d.contact_email??null, d.contact_phone??null, d.stage??'new', d.assigned_to??null, d.source??'manual', d.notes??null, d.value??null, d.category??null];
  if (d.created_at) {
    return (await getDb().execute({ sql: `INSERT INTO leads (company_name,contact_name,contact_email,contact_phone,stage,assigned_to,source,notes,value,category,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?::timestamptz,?::timestamptz) RETURNING id`, args: [...baseArgs, d.created_at, d.created_at] })).lastInsertRowid;
  }
  return (await getDb().execute({ sql: `INSERT INTO leads (company_name,contact_name,contact_email,contact_phone,stage,assigned_to,source,notes,value,category) VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id`, args: baseArgs })).lastInsertRowid;
}
export async function updateLead(id: number, data: Record<string, any>) {
  const keys = Object.keys(data);
  await getDb().execute({ sql: `UPDATE leads SET ${keys.map(k => `${k}=?`).join(',')},updated_at=NOW() WHERE id=?`, args: [...keys.map(k => data[k]), id] });
}
export async function softDeleteLead(id: number) {
  await getDb().execute({ sql: `UPDATE leads SET deleted_at=NOW() WHERE id=?`, args: [id] });
}
export async function softDeleteLeads(ids: number[]) {
  for (const id of ids) await getDb().execute({ sql: `UPDATE leads SET deleted_at=NOW() WHERE id=?`, args: [id] });
}
export async function restoreLeads(ids: number[]) {
  for (const id of ids) await getDb().execute({ sql: `UPDATE leads SET deleted_at=NULL WHERE id=?`, args: [id] });
}
export async function permanentDeleteLeads(ids: number[]) {
  for (const id of ids) await getDb().execute({ sql: `DELETE FROM leads WHERE id=?`, args: [id] });
}
// ─── Lead pool (unassigned, grabbable) ──────────────────────────────────────────
export async function getLeadPool(category?: string) {
  const where = ['l.deleted_at IS NULL', 'l.assigned_to IS NULL', "l.stage NOT IN ('closed_won','closed_lost')"];
  const args: any[] = [];
  if (category) { where.push('l.category=?'); args.push(category); }
  return (await getDb().execute({ sql: `
    SELECT l.*, COUNT(lu.id) as update_count
    FROM leads l LEFT JOIN lead_updates lu ON l.id=lu.lead_id
    WHERE ${where.join(' AND ')}
    GROUP BY l.id ORDER BY l.category NULLS LAST, l.created_at DESC`, args })).rows;
}
export async function grabLead(id: number, userId: number) {
  const r = await getDb().execute({ sql: `UPDATE leads SET assigned_to=?, updated_at=NOW() WHERE id=? AND assigned_to IS NULL AND deleted_at IS NULL RETURNING id`, args: [userId, id] });
  return r.rows.length > 0;
}
export async function bulkCreateLeads(rows: { company_name: string; contact_name?: string|null; contact_email?: string|null; contact_phone?: string|null; value?: string|null }[], category: string | null, source: string) {
  let n = 0;
  for (const r of rows) {
    if (!r.company_name?.trim()) continue;
    await getDb().execute({ sql: `INSERT INTO leads (company_name,contact_name,contact_email,contact_phone,value,category,source,assigned_to) VALUES (?,?,?,?,?,?,?,NULL)`, args: [r.company_name.trim(), r.contact_name||null, r.contact_email||null, r.contact_phone||null, r.value||null, category, source] });
    n++;
  }
  return n;
}

export async function bulkUpdateLeads(ids: number[], data: Record<string, any>) {
  const keys = Object.keys(data);
  for (const id of ids) await getDb().execute({ sql: `UPDATE leads SET ${keys.map(k => `${k}=?`).join(',')},updated_at=NOW() WHERE id=?`, args: [...keys.map(k => data[k]), id] });
}

// ─── Updates ──────────────────────────────────────────────────────────────────
export async function getUpdatesByLead(leadId: number) {
  return (await getDb().execute({ sql: `SELECT lu.*,u.name as user_name FROM lead_updates lu LEFT JOIN users u ON lu.user_id=u.id WHERE lu.lead_id=? ORDER BY lu.created_at DESC`, args: [leadId] })).rows;
}
export async function createUpdate(d: { lead_id: number; user_id?: number|null; content: string; stage_from?: string|null; stage_to?: string|null; source?: string; email_date?: string|null; created_at?: string|null; email_submission_id?: number|null }) {
  let r;
  const subId = d.email_submission_id ?? null;
  if (d.created_at) {
    r = await getDb().execute({ sql: `INSERT INTO lead_updates (lead_id,user_id,content,stage_from,stage_to,source,email_date,created_at,email_submission_id) VALUES (?,?,?,?,?,?,?,?::timestamptz,?) RETURNING id`, args: [d.lead_id, d.user_id??null, d.content, d.stage_from??null, d.stage_to??null, d.source??'manual', d.email_date??null, d.created_at, subId] });
    await getDb().execute({ sql: `UPDATE leads SET updated_at=GREATEST(updated_at, ?::timestamptz) WHERE id=?`, args: [d.created_at, d.lead_id] });
  } else {
    r = await getDb().execute({ sql: `INSERT INTO lead_updates (lead_id,user_id,content,stage_from,stage_to,source,email_date,email_submission_id) VALUES (?,?,?,?,?,?,?,?) RETURNING id`, args: [d.lead_id, d.user_id??null, d.content, d.stage_from??null, d.stage_to??null, d.source??'manual', d.email_date??null, subId] });
    await getDb().execute({ sql: `UPDATE leads SET updated_at=NOW() WHERE id=?`, args: [d.lead_id] });
  }
  return r.lastInsertRowid;
}
export async function deleteUpdate(id: number) {
  await getDb().execute({ sql: `DELETE FROM lead_updates WHERE id=?`, args: [id] });
}

// ─── Messages ─────────────────────────────────────────────────────────────────
export async function getMessages(userId: number) {
  return (await getDb().execute({ sql: `SELECT m.*,u1.name as from_name,u2.name as to_name,l.company_name as lead_name FROM messages m JOIN users u1 ON m.from_user_id=u1.id LEFT JOIN users u2 ON m.to_user_id=u2.id LEFT JOIN leads l ON m.lead_id=l.id WHERE m.to_user_id=? OR m.from_user_id=? ORDER BY m.created_at DESC`, args: [userId, userId] })).rows;
}
export async function getUnreadCount(userId: number) {
  return Number((await getDb().execute({ sql: `SELECT COUNT(*) as c FROM messages WHERE to_user_id=? AND is_read=0`, args: [userId] })).rows[0]?.c || 0);
}
export async function createMessage(d: { from_user_id: number; to_user_id: number|null; subject: string; body: string; lead_id?: number|null }) {
  return (await getDb().execute({ sql: `INSERT INTO messages (from_user_id,to_user_id,subject,body,lead_id) VALUES (?,?,?,?,?) RETURNING id`, args: [d.from_user_id, d.to_user_id??null, d.subject, d.body, d.lead_id??null] })).lastInsertRowid;
}
export async function markMessageRead(id: number) {
  await getDb().execute({ sql: `UPDATE messages SET is_read=1 WHERE id=?`, args: [id] });
}
export async function deleteMessage(id: number) {
  await getDb().execute({ sql: `DELETE FROM messages WHERE id=?`, args: [id] });
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
export async function getEvents(userId: number) {
  return (await getDb().execute({ sql: `SELECT e.*,l.company_name as lead_name FROM calendar_events e LEFT JOIN leads l ON e.lead_id=l.id WHERE e.user_id=? ORDER BY e.event_date ASC, e.event_time ASC`, args: [userId] })).rows;
}
export async function getAllEvents() {
  return (await getDb().execute(`SELECT e.*,u.name as user_name,l.company_name as lead_name FROM calendar_events e JOIN users u ON e.user_id=u.id LEFT JOIN leads l ON e.lead_id=l.id ORDER BY e.event_date ASC, e.event_time ASC`)).rows;
}
export async function createEvent(d: { user_id: number; lead_id?: number|null; title: string; description?: string|null; event_date: string; event_time?: string|null; type?: string }) {
  return (await getDb().execute({ sql: `INSERT INTO calendar_events (user_id,lead_id,title,description,event_date,event_time,type) VALUES (?,?,?,?,?,?,?) RETURNING id`, args: [d.user_id, d.lead_id??null, d.title, d.description??null, d.event_date, d.event_time??null, d.type??'Meeting'] })).lastInsertRowid;
}
export async function deleteEvent(id: number) {
  await getDb().execute({ sql: `DELETE FROM calendar_events WHERE id=?`, args: [id] });
}

// ─── Email Submissions ────────────────────────────────────────────────────────
export async function createSubmission(d: { user_id: number; assigned_to?: number|null; email_text: string; email_date?: string|null; summary?: string|null; leads_created?: number; leads_updated?: number }) {
  return (await getDb().execute({
    sql: `INSERT INTO email_submissions (user_id,assigned_to,email_text,email_date,summary,leads_created,leads_updated) VALUES (?,?,?,?,?,?,?) RETURNING id`,
    args: [d.user_id, d.assigned_to ?? null, d.email_text, d.email_date ?? null, d.summary ?? null, d.leads_created ?? 0, d.leads_updated ?? 0],
  })).lastInsertRowid;
}
export async function updateSubmissionResults(id: number, summary: string|null, leadsCreated: number, leadsUpdated: number) {
  await getDb().execute({
    sql: `UPDATE email_submissions SET summary=?,leads_created=?,leads_updated=? WHERE id=?`,
    args: [summary, leadsCreated, leadsUpdated, id],
  });
}
export async function getSubmissionsForUser(userId: number, role: string) {
  // Salesman sees own submissions + ones assigned to them; admin/manager see all
  const isStaff = role === 'admin' || role === 'manager';
  const sql = isStaff
    ? `SELECT s.*,u.name as user_name,a.name as assigned_name
       FROM email_submissions s
       LEFT JOIN users u ON s.user_id=u.id
       LEFT JOIN users a ON s.assigned_to=a.id
       ORDER BY s.created_at DESC LIMIT 200`
    : `SELECT s.*,u.name as user_name,a.name as assigned_name
       FROM email_submissions s
       LEFT JOIN users u ON s.user_id=u.id
       LEFT JOIN users a ON s.assigned_to=a.id
       WHERE s.user_id=? OR s.assigned_to=?
       ORDER BY s.created_at DESC LIMIT 200`;
  const args = isStaff ? [] : [userId, userId];
  return (await getDb().execute({ sql, args })).rows;
}
export async function getSubmissionById(id: number) {
  const sub = (await getDb().execute({
    sql: `SELECT s.*,u.name as user_name,u.email as user_email,a.name as assigned_name
          FROM email_submissions s
          LEFT JOIN users u ON s.user_id=u.id
          LEFT JOIN users a ON s.assigned_to=a.id
          WHERE s.id=?`,
    args: [id],
  })).rows[0] || null;
  if (!sub) return null;
  const updates = (await getDb().execute({
    sql: `SELECT lu.*,l.company_name,l.stage as lead_stage
          FROM lead_updates lu JOIN leads l ON lu.lead_id=l.id
          WHERE lu.email_submission_id=? ORDER BY lu.created_at ASC`,
    args: [id],
  })).rows;
  return { ...sub, updates };
}

// ─── Feature Requests ─────────────────────────────────────────────────────────
export async function createFeatureRequest(d: { user_id: number; title: string; description: string }) {
  return (await getDb().execute({
    sql: `INSERT INTO feature_requests (user_id,title,description) VALUES (?,?,?) RETURNING id`,
    args: [d.user_id, d.title, d.description],
  })).lastInsertRowid;
}
export async function getFeatureRequestsForUser(userId: number, role: string) {
  const isStaff = role === 'admin' || role === 'manager';
  const sql = isStaff
    ? `SELECT f.*,u.name as user_name,
        (SELECT COUNT(*) FROM feature_request_comments c WHERE c.request_id=f.id) as comment_count
       FROM feature_requests f LEFT JOIN users u ON f.user_id=u.id
       ORDER BY CASE f.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'done' THEN 2 ELSE 3 END, f.updated_at DESC`
    : `SELECT f.*,u.name as user_name,
        (SELECT COUNT(*) FROM feature_request_comments c WHERE c.request_id=f.id) as comment_count
       FROM feature_requests f LEFT JOIN users u ON f.user_id=u.id
       WHERE f.user_id=?
       ORDER BY CASE f.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'done' THEN 2 ELSE 3 END, f.updated_at DESC`;
  const args = isStaff ? [] : [userId];
  return (await getDb().execute({ sql, args })).rows;
}
export async function getFeatureRequestById(id: number) {
  const req = (await getDb().execute({
    sql: `SELECT f.*,u.name as user_name FROM feature_requests f LEFT JOIN users u ON f.user_id=u.id WHERE f.id=?`,
    args: [id],
  })).rows[0] || null;
  if (!req) return null;
  const comments = (await getDb().execute({
    sql: `SELECT c.*,u.name as user_name,u.role as user_role
          FROM feature_request_comments c LEFT JOIN users u ON c.user_id=u.id
          WHERE c.request_id=? ORDER BY c.created_at ASC`,
    args: [id],
  })).rows;
  return { ...req, comments };
}
export async function updateFeatureRequestStatus(id: number, status: string) {
  await getDb().execute({
    sql: `UPDATE feature_requests SET status=?,updated_at=NOW() WHERE id=?`,
    args: [status, id],
  });
}
export async function addFeatureRequestComment(d: { request_id: number; user_id: number; content: string }) {
  const r = await getDb().execute({
    sql: `INSERT INTO feature_request_comments (request_id,user_id,content) VALUES (?,?,?) RETURNING id`,
    args: [d.request_id, d.user_id, d.content],
  });
  await getDb().execute({ sql: `UPDATE feature_requests SET updated_at=NOW() WHERE id=?`, args: [d.request_id] });
  return r.lastInsertRowid;
}

// ─── Tasks ────────────────────────────────────────────────────────────────────
export async function getTasksForUser(userId: number, opts?: { includeCompleted?: boolean; leadId?: number }) {
  const includeCompleted = opts?.includeCompleted ?? false;
  if (opts?.leadId !== undefined) {
    return (await getDb().execute({
      sql: `SELECT t.*, l.company_name as lead_name FROM tasks t LEFT JOIN leads l ON t.lead_id=l.id WHERE t.user_id=? AND t.lead_id=? ORDER BY t.completed_at IS NULL DESC, t.due_date ASC NULLS LAST, t.created_at DESC`,
      args: [userId, opts.leadId],
    })).rows;
  }
  if (includeCompleted) {
    return (await getDb().execute({
      sql: `SELECT t.*, l.company_name as lead_name FROM tasks t LEFT JOIN leads l ON t.lead_id=l.id WHERE t.user_id=? ORDER BY t.completed_at IS NULL DESC, t.due_date ASC NULLS LAST, t.created_at DESC`,
      args: [userId],
    })).rows;
  }
  return (await getDb().execute({
    sql: `SELECT t.*, l.company_name as lead_name FROM tasks t LEFT JOIN leads l ON t.lead_id=l.id WHERE t.user_id=? AND t.completed_at IS NULL ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC`,
    args: [userId],
  })).rows;
}
export async function getTaskById(id: number) {
  return (await getDb().execute({ sql: `SELECT * FROM tasks WHERE id=?`, args: [id] })).rows[0] || null;
}
export async function createTask(d: { user_id: number; lead_id?: number|null; title: string; description?: string|null; due_date?: string|null }) {
  return (await getDb().execute({
    sql: `INSERT INTO tasks (user_id,lead_id,title,description,due_date) VALUES (?,?,?,?,?) RETURNING id`,
    args: [d.user_id, d.lead_id ?? null, d.title, d.description ?? null, d.due_date ?? null],
  })).lastInsertRowid;
}
export async function updateTask(id: number, data: Record<string, any>) {
  const keys = Object.keys(data);
  if (keys.length === 0) return;
  await getDb().execute({
    sql: `UPDATE tasks SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`,
    args: [...keys.map(k => data[k]), id],
  });
}
export async function deleteTask(id: number) {
  await getDb().execute({ sql: `DELETE FROM tasks WHERE id=?`, args: [id] });
}

// ─── Audit Questions (admin-configured) ─────────────────────────────────────────
export async function getActiveAuditQuestions() {
  return (await getDb().execute(`SELECT id,prompt,options,allow_other,sort_order FROM audit_questions WHERE is_active=1 ORDER BY sort_order ASC, id ASC`)).rows;
}
export async function getAllAuditQuestions() {
  return (await getDb().execute(`SELECT id,prompt,options,allow_other,sort_order,is_active FROM audit_questions ORDER BY sort_order ASC, id ASC`)).rows;
}
export async function createAuditQuestion(d: { prompt: string; options: string[]; allow_other: boolean }) {
  const next = (await getDb().execute(`SELECT COALESCE(MAX(sort_order),-1)+1 as n FROM audit_questions`)).rows[0];
  return (await getDb().execute({
    sql: `INSERT INTO audit_questions (prompt,options,allow_other,sort_order) VALUES (?,?,?,?) RETURNING id`,
    args: [d.prompt, JSON.stringify(d.options || []), d.allow_other ? 1 : 0, Number((next as any)?.n || 0)],
  })).lastInsertRowid;
}
export async function updateAuditQuestion(id: number, d: { prompt?: string; options?: string[]; allow_other?: boolean; is_active?: boolean }) {
  const data: Record<string, any> = {};
  if (d.prompt !== undefined) data.prompt = d.prompt;
  if (d.options !== undefined) data.options = JSON.stringify(d.options);
  if (d.allow_other !== undefined) data.allow_other = d.allow_other ? 1 : 0;
  if (d.is_active !== undefined) data.is_active = d.is_active ? 1 : 0;
  const keys = Object.keys(data);
  if (keys.length === 0) return;
  await getDb().execute({ sql: `UPDATE audit_questions SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`, args: [...keys.map(k => data[k]), id] });
}
export async function deleteAuditQuestion(id: number) {
  await getDb().execute({ sql: `DELETE FROM audit_questions WHERE id=?`, args: [id] });
}

// ─── Scheduled Audits (admin-created) ───────────────────────────────────────────
// An audit covers the period since the previous audit, up to its audit_date, and
// targets a chosen set of leads (or all active leads). Reps complete it per lead.
export async function createScheduledAudit(d: { audit_date: string; scope: 'all' | 'selected'; lead_ids?: number[]; created_by: number; title?: string | null }) {
  const db = getDb();
  const prev = await db.execute(`SELECT audit_date FROM audits ORDER BY audit_date DESC, id DESC LIMIT 1`);
  const period_start = (prev.rows[0] as any)?.audit_date ?? null;
  const id = (await db.execute({
    sql: `INSERT INTO audits (title,audit_date,period_start,scope,created_by) VALUES (?,?,?,?,?) RETURNING id`,
    args: [d.title ?? null, d.audit_date, period_start, d.scope, d.created_by],
  })).lastInsertRowid;
  let leadIds: number[] = [];
  if (d.scope === 'all') {
    const rows = (await db.execute(`SELECT id FROM leads WHERE deleted_at IS NULL AND stage NOT IN ('closed_won','closed_lost')`)).rows;
    leadIds = rows.map((r: any) => Number(r.id));
  } else {
    leadIds = Array.from(new Set((d.lead_ids || []).map(Number).filter(Boolean)));
  }
  for (const lid of leadIds) {
    await db.execute({ sql: `INSERT INTO audit_targets (audit_id,lead_id) VALUES (?,?) ON CONFLICT (audit_id,lead_id) DO NOTHING`, args: [id, lid] });
  }
  return { id, target_count: leadIds.length };
}

export async function getScheduledAudits() {
  return (await getDb().execute(`
    SELECT a.id, a.title, a.audit_date, a.period_start, a.scope, a.is_closed, a.created_at, u.name as created_by_name,
      (SELECT COUNT(*) FROM audit_targets t WHERE t.audit_id=a.id)::int as target_count,
      (SELECT COUNT(*) FROM audit_responses r WHERE r.audit_id=a.id)::int as done_count
    FROM audits a LEFT JOIN users u ON a.created_by=u.id
    ORDER BY a.audit_date DESC, a.id DESC
  `)).rows;
}

export async function getScheduledAuditDetail(id: number) {
  const audit = (await getDb().execute({ sql: `SELECT a.*, u.name as created_by_name FROM audits a LEFT JOIN users u ON a.created_by=u.id WHERE a.id=?`, args: [id] })).rows[0] || null;
  if (!audit) return null;
  const targets = (await getDb().execute({ sql: `
    SELECT t.lead_id, l.company_name, l.contact_name, l.stage, l.assigned_to, au.name as assigned_name,
      r.id as response_id, r.answers, r.plan_text, r.prev_plan_status, r.prev_plan_note, ru.name as responder_name, r.updated_at as response_updated_at
    FROM audit_targets t
    JOIN leads l ON t.lead_id=l.id
    LEFT JOIN users au ON l.assigned_to=au.id
    LEFT JOIN audit_responses r ON r.audit_id=t.audit_id AND r.lead_id=t.lead_id
    LEFT JOIN users ru ON r.user_id=ru.id
    WHERE t.audit_id=?
    ORDER BY (r.id IS NOT NULL) ASC, l.company_name ASC
  `, args: [id] })).rows;
  return { ...audit, targets };
}

export async function deleteScheduledAudit(id: number) {
  await getDb().execute({ sql: `DELETE FROM audits WHERE id=?`, args: [id] });
}
export async function setAuditClosed(id: number, closed: boolean) {
  await getDb().execute({ sql: `UPDATE audits SET is_closed=? WHERE id=?`, args: [closed ? 1 : 0, id] });
}
export async function getAuditById(id: number) {
  return (await getDb().execute({ sql: `SELECT * FROM audits WHERE id=?`, args: [id] })).rows[0] || null;
}
export async function isAuditTarget(auditId: number, leadId: number) {
  return (await getDb().execute({ sql: `SELECT 1 FROM audit_targets WHERE audit_id=? AND lead_id=?`, args: [auditId, leadId] })).rows.length > 0;
}

// Audit items (audit × lead) for a user. Reps see leads assigned to them; staff
// can pass a leadId to view a specific lead's items regardless of assignment.
export async function getAuditInbox(opts: { userId: number; isStaff?: boolean; leadId?: number; page?: number; pageSize?: number }) {
  const pageSize = opts.pageSize ?? 50;
  const page = Math.max(0, opts.page ?? 0);
  const where: string[] = [`a.is_closed=0`, `l.deleted_at IS NULL`];
  const args: any[] = [];
  if (!opts.isStaff) { where.push(`l.assigned_to=?`); args.push(opts.userId); }
  if (opts.leadId) { where.push(`l.id=?`); args.push(opts.leadId); }
  const whereSql = where.join(' AND ');
  const total = Number((await getDb().execute({
    sql: `SELECT COUNT(*)::int as c FROM audit_targets t JOIN audits a ON t.audit_id=a.id JOIN leads l ON t.lead_id=l.id WHERE ${whereSql}`,
    args,
  })).rows[0]?.c || 0);
  const items = (await getDb().execute({ sql: `
    SELECT a.id as audit_id, a.audit_date, a.period_start, a.title,
      l.id as lead_id, l.company_name, l.contact_name, l.stage, l.updated_at,
      r.id as response_id, r.answers, r.plan_text, r.prev_plan_status, r.prev_plan_note, r.updated_at as response_updated_at,
      p.plan_text as prev_plan_text, p.audit_date as prev_audit_date
    FROM audit_targets t
    JOIN audits a ON t.audit_id=a.id
    JOIN leads l ON t.lead_id=l.id
    LEFT JOIN audit_responses r ON r.audit_id=a.id AND r.lead_id=l.id
    LEFT JOIN LATERAL (
      SELECT ar.plan_text, a2.audit_date FROM audit_responses ar JOIN audits a2 ON ar.audit_id=a2.id
      WHERE ar.lead_id=l.id AND a2.id <> a.id AND a2.audit_date <= a.audit_date
      ORDER BY a2.audit_date DESC, a2.id DESC LIMIT 1
    ) p ON TRUE
    WHERE ${whereSql}
    ORDER BY (r.id IS NOT NULL) ASC, a.audit_date DESC, l.updated_at DESC
    LIMIT ${pageSize} OFFSET ${page * pageSize}
  `, args })).rows;
  return { items, total, page, pageSize };
}

export async function countPendingAuditsForUser(userId: number) {
  return Number((await getDb().execute({ sql: `
    SELECT COUNT(*)::int as c
    FROM audit_targets t JOIN audits a ON t.audit_id=a.id JOIN leads l ON t.lead_id=l.id
    LEFT JOIN audit_responses r ON r.audit_id=a.id AND r.lead_id=l.id
    WHERE a.is_closed=0 AND l.deleted_at IS NULL AND l.assigned_to=? AND r.id IS NULL
  `, args: [userId] })).rows[0]?.c || 0);
}

// ─── Files (DB-stored: shared by admin, or personal) ────────────────────────────
export async function createFile(d: { owner_id: number; scope: string; name: string; mime?: string | null; size?: number | null; data: string }) {
  return (await getDb().execute({ sql: `INSERT INTO files (owner_id,scope,name,mime,size,data) VALUES (?,?,?,?,?,?) RETURNING id`, args: [d.owner_id, d.scope, d.name, d.mime ?? null, d.size ?? null, d.data] })).lastInsertRowid;
}
export async function getFilesForUser(userId: number) {
  return (await getDb().execute({ sql: `SELECT f.id,f.owner_id,f.scope,f.name,f.mime,f.size,f.created_at,u.name as owner_name FROM files f LEFT JOIN users u ON f.owner_id=u.id WHERE f.scope='shared' OR f.owner_id=? ORDER BY f.created_at DESC`, args: [userId] })).rows;
}
export async function getFileById(id: number) {
  return (await getDb().execute({ sql: `SELECT * FROM files WHERE id=?`, args: [id] })).rows[0] || null;
}
export async function deleteFile(id: number) {
  await getDb().execute({ sql: `DELETE FROM files WHERE id=?`, args: [id] });
}

// ─── Email Accounts (per-user IMAP/SMTP) ────────────────────────────────────────
export async function getEmailAccountRaw(userId: number) {
  return (await getDb().execute({ sql: `SELECT * FROM email_accounts WHERE user_id=?`, args: [userId] })).rows[0] || null;
}
export async function upsertEmailAccount(userId: number, data: Record<string, any>) {
  const keys = Object.keys(data);
  if (keys.length === 0) return;
  const existing = await getEmailAccountRaw(userId);
  if (existing) {
    await getDb().execute({ sql: `UPDATE email_accounts SET ${keys.map(k => `${k}=?`).join(',')}, updated_at=NOW() WHERE user_id=?`, args: [...keys.map(k => data[k]), userId] });
  } else {
    await getDb().execute({ sql: `INSERT INTO email_accounts (user_id, ${keys.join(',')}) VALUES (?, ${keys.map(() => '?').join(',')})`, args: [userId, ...keys.map(k => data[k])] });
  }
}
export async function markEmailSynced(userId: number) {
  await getDb().execute({ sql: `UPDATE email_accounts SET last_synced_at=NOW() WHERE user_id=?`, args: [userId] });
}

// ─── Email mailbox (threads + messages) ─────────────────────────────────────────
export async function findLeadByEmail(email: string) {
  if (!email) return null;
  return (await getDb().execute({ sql: `SELECT id, company_name, contact_name, stage FROM leads WHERE deleted_at IS NULL AND LOWER(TRIM(contact_email))=LOWER(TRIM(?)) LIMIT 1`, args: [email] })).rows[0] || null;
}
export async function emailMessageExists(userId: number, messageId: string | null) {
  if (!messageId) return false;
  return (await getDb().execute({ sql: `SELECT 1 FROM email_messages WHERE user_id=? AND message_id=? LIMIT 1`, args: [userId, messageId] })).rows.length > 0;
}
export async function getThreadByKey(userId: number, key: string) {
  return (await getDb().execute({ sql: `SELECT * FROM email_threads WHERE user_id=? AND thread_key=?`, args: [userId, key] })).rows[0] || null;
}
export async function upsertThreadForMessage(userId: number, key: string, d: { name?: string | null; email?: string | null; subject?: string | null; lastAt: string | Date; snippet?: string | null; inbound: boolean; lead_id?: number | null }) {
  const existing: any = await getThreadByKey(userId, key);
  const lastAt = (d.lastAt instanceof Date ? d.lastAt : new Date(d.lastAt)).toISOString();
  if (existing) {
    await getDb().execute({ sql: `
      UPDATE email_threads SET
        subject = COALESCE(subject, ?),
        counterpart_name = COALESCE(NULLIF(counterpart_name,''), ?),
        counterpart_email = COALESCE(counterpart_email, ?),
        lead_id = COALESCE(lead_id, ?),
        last_message_at = GREATEST(COALESCE(last_message_at, ?::timestamptz), ?::timestamptz),
        last_snippet = ?,
        unread = unread + ?,
        updated_at = NOW()
      WHERE id=?`,
      args: [d.subject ?? null, d.name ?? '', d.email ?? key, d.lead_id ?? null, lastAt, lastAt, d.snippet ?? '', d.inbound ? 1 : 0, existing.id] });
    return existing.id as number;
  }
  return (await getDb().execute({ sql: `
    INSERT INTO email_threads (user_id, thread_key, lead_id, counterpart_name, counterpart_email, subject, last_message_at, last_snippet, unread)
    VALUES (?,?,?,?,?,?,?::timestamptz,?,?) RETURNING id`,
    args: [userId, key, d.lead_id ?? null, d.name ?? '', d.email ?? key, d.subject ?? null, lastAt, d.snippet ?? '', d.inbound ? 1 : 0] })).lastInsertRowid;
}
export async function insertEmailMessage(d: { thread_id: number; user_id: number; direction: 'in' | 'out'; from_addr?: string | null; from_name?: string | null; to_addr?: string | null; subject?: string | null; body_text?: string | null; message_id?: string | null; in_reply_to?: string | null; imap_uid?: number | null; sent_at?: string | Date | null }) {
  const sentAt = d.sent_at ? (d.sent_at instanceof Date ? d.sent_at : new Date(d.sent_at)).toISOString() : new Date().toISOString();
  return (await getDb().execute({ sql: `
    INSERT INTO email_messages (thread_id,user_id,direction,from_addr,from_name,to_addr,subject,body_text,message_id,in_reply_to,imap_uid,sent_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?::timestamptz) RETURNING id`,
    args: [d.thread_id, d.user_id, d.direction, d.from_addr ?? null, d.from_name ?? null, d.to_addr ?? null, d.subject ?? null, d.body_text ?? null, d.message_id ?? null, d.in_reply_to ?? null, d.imap_uid ?? null, sentAt] })).lastInsertRowid;
}
export async function getEmailThreads(userId: number, opts: { tab?: string; search?: string }) {
  const where: string[] = ['t.user_id=?'];
  const args: any[] = [userId];
  if (opts.tab === 'starred') { where.push('t.starred=1', 't.archived=0'); }
  else if (opts.tab === 'archived') { where.push('t.archived=1'); }
  else { where.push('t.archived=0'); }
  if (opts.search?.trim()) { where.push('(t.subject ILIKE ? OR t.counterpart_name ILIKE ? OR t.counterpart_email ILIKE ?)'); const s = `%${opts.search.trim()}%`; args.push(s, s, s); }
  return (await getDb().execute({ sql: `
    SELECT t.*, l.company_name as lead_name FROM email_threads t
    LEFT JOIN leads l ON t.lead_id=l.id
    WHERE ${where.join(' AND ')}
    ORDER BY t.last_message_at DESC NULLS LAST, t.id DESC LIMIT 200`, args })).rows;
}
export async function getEmailThreadFull(userId: number, threadId: number) {
  const t: any = (await getDb().execute({ sql: `SELECT t.*, l.company_name as lead_name, l.stage as lead_stage FROM email_threads t LEFT JOIN leads l ON t.lead_id=l.id WHERE t.user_id=? AND t.id=?`, args: [userId, threadId] })).rows[0] || null;
  if (!t) return null;
  const messages = (await getDb().execute({ sql: `SELECT * FROM email_messages WHERE thread_id=? ORDER BY sent_at ASC, id ASC`, args: [threadId] })).rows;
  return { ...t, messages };
}
export async function setThreadFlags(userId: number, threadId: number, data: Record<string, any>) {
  const keys = Object.keys(data);
  if (keys.length === 0) return;
  await getDb().execute({ sql: `UPDATE email_threads SET ${keys.map(k => `${k}=?`).join(',')}, updated_at=NOW() WHERE user_id=? AND id=?`, args: [...keys.map(k => data[k]), userId, threadId] });
}
export async function getUnreadEmailCount(userId: number) {
  return Number((await getDb().execute({ sql: `SELECT COALESCE(SUM(unread),0)::int as c FROM email_threads WHERE user_id=? AND archived=0`, args: [userId] })).rows[0]?.c || 0);
}
export async function getAutopilotThreads(userId: number) {
  return (await getDb().execute({ sql: `SELECT * FROM email_threads WHERE user_id=? AND autopilot=1 AND archived=0`, args: [userId] })).rows;
}
export async function setThreadSummary(userId: number, threadId: number, summary: string) {
  await getDb().execute({ sql: `UPDATE email_threads SET summary=? WHERE user_id=? AND id=?`, args: [summary, userId, threadId] });
}
export async function getSentThreads(userId: number) {
  return (await getDb().execute({ sql: `
    SELECT t.*, l.company_name as lead_name FROM email_threads t
    JOIN (SELECT DISTINCT thread_id FROM email_messages WHERE user_id=? AND direction='out') s ON s.thread_id=t.id
    LEFT JOIN leads l ON t.lead_id=l.id
    WHERE t.user_id=? ORDER BY t.last_message_at DESC NULLS LAST LIMIT 200`, args: [userId, userId] })).rows;
}
export async function getDraftThreads(userId: number) {
  return (await getDb().execute({ sql: `
    SELECT t.*, l.company_name as lead_name FROM email_threads t LEFT JOIN leads l ON t.lead_id=l.id
    WHERE t.user_id=? AND t.draft_text IS NOT NULL AND t.draft_text<>'' ORDER BY t.last_message_at DESC NULLS LAST LIMIT 200`, args: [userId] })).rows;
}
// Scheduled-send outbox
export async function createOutbox(d: { user_id: number; thread_id?: number | null; to_addr: string; subject?: string | null; body: string; send_at: string }) {
  return (await getDb().execute({ sql: `INSERT INTO email_outbox (user_id,thread_id,to_addr,subject,body,send_at) VALUES (?,?,?,?,?,?::timestamptz) RETURNING id`, args: [d.user_id, d.thread_id ?? null, d.to_addr, d.subject ?? null, d.body, d.send_at] })).lastInsertRowid;
}
export async function getScheduledOutbox(userId: number) {
  return (await getDb().execute({ sql: `SELECT o.*, l.company_name as lead_name FROM email_outbox o LEFT JOIN email_threads t ON o.thread_id=t.id LEFT JOIN leads l ON t.lead_id=l.id WHERE o.user_id=? ORDER BY o.send_at ASC`, args: [userId] })).rows;
}
export async function getDueOutbox(userId: number) {
  return (await getDb().execute({ sql: `SELECT * FROM email_outbox WHERE user_id=? AND send_at<=NOW() ORDER BY send_at ASC LIMIT 20`, args: [userId] })).rows;
}
export async function deleteOutbox(id: number) {
  await getDb().execute({ sql: `DELETE FROM email_outbox WHERE id=?`, args: [id] });
}

export async function upsertAuditResponse(d: { audit_id: number; lead_id: number; user_id: number; answers: any; plan_text: string; prev_plan_status?: string | null; prev_plan_note?: string | null }) {
  await getDb().execute({ sql: `
    INSERT INTO audit_responses (audit_id,lead_id,user_id,answers,plan_text,prev_plan_status,prev_plan_note)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT (audit_id,lead_id)
    DO UPDATE SET answers=EXCLUDED.answers, plan_text=EXCLUDED.plan_text, prev_plan_status=EXCLUDED.prev_plan_status, prev_plan_note=EXCLUDED.prev_plan_note, user_id=EXCLUDED.user_id, updated_at=NOW()
  `, args: [d.audit_id, d.lead_id, d.user_id, JSON.stringify(d.answers || {}), d.plan_text, d.prev_plan_status ?? null, d.prev_plan_note ?? null] });
}

// ─── My (Salesman) ────────────────────────────────────────────────────────────
export async function getMyLeads(userId: number) {
  return (await getDb().execute({ sql: `
    SELECT l.*,u.name as assigned_name,COUNT(lu.id) as update_count,MAX(lu.created_at) as last_update
    FROM leads l LEFT JOIN users u ON l.assigned_to=u.id
    LEFT JOIN lead_updates lu ON l.id=lu.lead_id
    WHERE l.deleted_at IS NULL AND l.assigned_to=?
    GROUP BY l.id, u.name ORDER BY l.updated_at DESC
  `, args: [userId] })).rows;
}

export async function getMyHomeStats(userId: number) {
  const db = getDb();
  const [staleLeads, activeLeads, upcomingEvents, recentUpdates, counts, urgentTasks, trendData, valueRows, wonThisMonth, leadTrend, byStageRows] = await Promise.all([
    db.execute({ sql: `
      SELECT l.id,l.company_name,l.stage,l.contact_name,l.updated_at,
        (SELECT MAX(created_at) FROM lead_updates WHERE lead_id=l.id) as last_update
      FROM leads l
      WHERE l.deleted_at IS NULL AND l.assigned_to=?
        AND l.stage NOT IN ('closed_won','closed_lost')
        AND l.updated_at < NOW() - INTERVAL '7 days'
      ORDER BY l.updated_at ASC LIMIT 20
    `, args: [userId] }),
    db.execute({ sql: `
      SELECT l.id,l.company_name,l.stage,l.contact_name,l.updated_at
      FROM leads l
      WHERE l.deleted_at IS NULL AND l.assigned_to=?
        AND l.stage NOT IN ('closed_won','closed_lost')
      ORDER BY l.updated_at DESC
    `, args: [userId] }),
    db.execute({ sql: `
      SELECT e.*,l.company_name as lead_name
      FROM calendar_events e LEFT JOIN leads l ON e.lead_id=l.id
      WHERE e.user_id=? AND e.event_date>=TO_CHAR(NOW(), 'YYYY-MM-DD')
      ORDER BY e.event_date ASC, e.event_time ASC LIMIT 10
    `, args: [userId] }),
    db.execute({ sql: `
      SELECT lu.*,l.company_name
      FROM lead_updates lu JOIN leads l ON lu.lead_id=l.id
      WHERE l.deleted_at IS NULL AND l.assigned_to=?
      ORDER BY lu.created_at DESC LIMIT 8
    `, args: [userId] }),
    db.execute({ sql: `
      SELECT
        COUNT(*) FILTER (WHERE stage NOT IN ('closed_won','closed_lost')) as active,
        COUNT(*) FILTER (WHERE stage='closed_won') as won,
        COUNT(*) FILTER (WHERE stage='closed_lost') as lost,
        COUNT(*) FILTER (WHERE created_at>=NOW() - INTERVAL '7 days') as new_this_week
      FROM leads WHERE deleted_at IS NULL AND assigned_to=?
    `, args: [userId] }),
    db.execute({ sql: `
      SELECT t.*, l.company_name as lead_name
      FROM tasks t LEFT JOIN leads l ON t.lead_id=l.id
      WHERE t.user_id=? AND t.completed_at IS NULL
        AND t.due_date IS NOT NULL
        AND t.due_date <= TO_CHAR(NOW(), 'YYYY-MM-DD')
      ORDER BY t.due_date ASC LIMIT 10
    `, args: [userId] }),
    db.execute({ sql: `
      SELECT TO_CHAR(DATE(created_at), 'YYYY-MM-DD') as day, COUNT(*)::int as c
      FROM lead_updates
      WHERE user_id=? AND created_at>=NOW() - INTERVAL '30 days'
      GROUP BY day ORDER BY day ASC
    `, args: [userId] }),
    db.execute({ sql: `
      SELECT value, stage FROM leads
      WHERE deleted_at IS NULL AND assigned_to=?
        AND stage NOT IN ('closed_won','closed_lost')
        AND value IS NOT NULL AND value != ''
    `, args: [userId] }),
    db.execute({ sql: `
      SELECT value FROM leads
      WHERE deleted_at IS NULL AND assigned_to=?
        AND stage='closed_won'
        AND updated_at >= DATE_TRUNC('month', NOW())
        AND value IS NOT NULL AND value != ''
    `, args: [userId] }),
    db.execute({ sql: `
      SELECT TO_CHAR(DATE(created_at), 'YYYY-MM-DD') as day, COUNT(*)::int as c
      FROM leads
      WHERE deleted_at IS NULL AND assigned_to=?
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY day ORDER BY day ASC
    `, args: [userId] }),
    db.execute({ sql: `
      SELECT stage, COUNT(*)::int as c
      FROM leads WHERE deleted_at IS NULL AND assigned_to=?
      GROUP BY stage
    `, args: [userId] }),
  ]);
  const by_stage: Record<string, number> = {};
  for (const r of byStageRows.rows as any[]) by_stage[r.stage] = Number(r.c);
  const c: any = counts.rows[0] || {};
  const stageProb: Record<string, number> = { new: 0.1, contacted: 0.25, follow_up: 0.4, proposal: 0.7 };
  const parseV = (s: any) => { const n = parseFloat(String(s||'').replace(/[^\d.]/g,'')); return isNaN(n) ? 0 : n; };
  let pipelineValue = 0, weightedForecast = 0;
  for (const r of valueRows.rows as any[]) {
    const v = parseV(r.value);
    pipelineValue += v;
    weightedForecast += v * (stageProb[r.stage] || 0);
  }
  let wonValueThisMonth = 0;
  for (const r of wonThisMonth.rows as any[]) wonValueThisMonth += parseV(r.value);
  return {
    stale_leads: staleLeads.rows,
    active_leads: activeLeads.rows,
    upcoming_events: upcomingEvents.rows,
    recent_updates: recentUpdates.rows,
    urgent_tasks: urgentTasks.rows,
    trend_data: trendData.rows,
    lead_trend: leadTrend.rows,
    by_stage,
    counts: {
      active: Number(c.active||0),
      won: Number(c.won||0),
      lost: Number(c.lost||0),
      new_this_week: Number(c.new_this_week||0),
    },
    goals: {
      pipeline_value: Math.round(pipelineValue),
      weighted_forecast: Math.round(weightedForecast),
      won_value_this_month: Math.round(wonValueThisMonth),
      won_count_this_month: (wonThisMonth.rows as any[]).length,
    },
  };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export async function getDashboardStats() {
  const db = getDb();
  const [total, newWeek, won, lost, today, week, byStage, recent, topSales, trendData] = await Promise.all([
    db.execute(`SELECT COUNT(*) as c FROM leads WHERE deleted_at IS NULL`),
    db.execute(`SELECT COUNT(*) as c FROM leads WHERE deleted_at IS NULL AND created_at>=NOW() - INTERVAL '7 days'`),
    db.execute(`SELECT COUNT(*) as c FROM leads WHERE deleted_at IS NULL AND stage='closed_won'`),
    db.execute(`SELECT COUNT(*) as c FROM leads WHERE deleted_at IS NULL AND stage='closed_lost'`),
    db.execute(`SELECT COUNT(*) as c FROM lead_updates WHERE created_at>=DATE_TRUNC('day', NOW())`),
    db.execute(`SELECT COUNT(*) as c FROM lead_updates WHERE created_at>=NOW() - INTERVAL '7 days'`),
    db.execute(`SELECT stage,COUNT(*) as c FROM leads WHERE deleted_at IS NULL GROUP BY stage`),
    db.execute(`SELECT lu.*,l.company_name,u.name as user_name FROM lead_updates lu JOIN leads l ON lu.lead_id=l.id LEFT JOIN users u ON lu.user_id=u.id WHERE l.deleted_at IS NULL ORDER BY lu.created_at DESC LIMIT 8`),
    db.execute(`SELECT u.name,COUNT(lu.id) as update_count FROM lead_updates lu JOIN users u ON lu.user_id=u.id WHERE lu.created_at>=NOW() - INTERVAL '7 days' GROUP BY u.name ORDER BY update_count DESC LIMIT 3`),
    db.execute(`SELECT TO_CHAR(DATE(created_at), 'YYYY-MM-DD') as day,COUNT(*)::int as c FROM leads WHERE deleted_at IS NULL AND created_at>=NOW() - INTERVAL '30 days' GROUP BY day ORDER BY day ASC`),
  ]);
  const by_stage: Record<string, number> = {};
  byStage.rows.forEach((r: any) => { by_stage[r.stage] = Number(r.c); });
  return {
    total_leads: Number((total.rows[0] as any).c),
    new_this_week: Number((newWeek.rows[0] as any).c),
    closed_won: Number((won.rows[0] as any).c),
    closed_lost: Number((lost.rows[0] as any).c),
    updates_today: Number((today.rows[0] as any).c),
    updates_this_week: Number((week.rows[0] as any).c),
    by_stage, recent_updates: recent.rows,
    top_salesmen: topSales.rows,
    trend_data: trendData.rows,
  };
}
