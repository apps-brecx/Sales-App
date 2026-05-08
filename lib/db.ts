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
    CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date)
  `);

  for (const col of ['deleted_at TIMESTAMPTZ DEFAULT NULL', 'value TEXT DEFAULT NULL', 'tags TEXT DEFAULT NULL']) {
    const colName = col.split(' ')[0];
    try { await db.execute(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS ${col}`); } catch {}
  }
  try { await db.execute(`ALTER TABLE lead_updates ADD COLUMN IF NOT EXISTS email_submission_id INTEGER REFERENCES email_submissions(id) ON DELETE SET NULL`); } catch {}

  const defaults = [
    ['company_name', 'My Company'], ['currency', 'USD'],
    ['timezone', 'America/New_York'], ['accent_color', 'indigo'],
  ];
  for (const [k, v] of defaults) {
    await db.execute({ sql: `INSERT INTO app_settings (key,value) VALUES (?,?) ON CONFLICT (key) DO NOTHING`, args: [k, v] });
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
  return (await getDb().execute(`SELECT id,name,email,role,is_active,created_at FROM users ORDER BY name`)).rows;
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
export async function createLead(d: { company_name: string; contact_name?: string|null; contact_email?: string|null; contact_phone?: string|null; stage?: string; assigned_to?: number|null; source?: string; notes?: string|null; value?: string|null; created_at?: string|null }) {
  const baseArgs = [d.company_name, d.contact_name??null, d.contact_email??null, d.contact_phone??null, d.stage??'new', d.assigned_to??null, d.source??'manual', d.notes??null, d.value??null];
  if (d.created_at) {
    return (await getDb().execute({ sql: `INSERT INTO leads (company_name,contact_name,contact_email,contact_phone,stage,assigned_to,source,notes,value,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?::timestamptz,?::timestamptz) RETURNING id`, args: [...baseArgs, d.created_at, d.created_at] })).lastInsertRowid;
  }
  return (await getDb().execute({ sql: `INSERT INTO leads (company_name,contact_name,contact_email,contact_phone,stage,assigned_to,source,notes,value) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id`, args: baseArgs })).lastInsertRowid;
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
