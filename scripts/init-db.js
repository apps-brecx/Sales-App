const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set. Add it to .env.local');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'salesman', is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY, company_name TEXT NOT NULL,
    contact_name TEXT, contact_email TEXT, contact_phone TEXT,
    stage TEXT NOT NULL DEFAULT 'new', assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    source TEXT NOT NULL DEFAULT 'manual', notes TEXT, value TEXT DEFAULT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS lead_updates (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL, stage_from TEXT, stage_to TEXT,
    source TEXT NOT NULL DEFAULT 'manual', email_date TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    subject TEXT NOT NULL, body TEXT NOT NULL,
    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS calendar_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    title TEXT NOT NULL, description TEXT,
    event_date TEXT NOT NULL, event_time TEXT,
    type TEXT NOT NULL DEFAULT 'Meeting',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS email_submissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    email_text TEXT NOT NULL,
    email_date TEXT,
    summary TEXT,
    leads_created INTEGER NOT NULL DEFAULT 0,
    leads_updated INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS feature_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS feature_request_comments (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS lead_audits (
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
  )`,
  `CREATE TABLE IF NOT EXISTS audit_questions (
    id SERIAL PRIMARY KEY,
    prompt TEXT NOT NULL,
    options TEXT NOT NULL DEFAULT '[]',
    allow_other INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE lead_audits ADD COLUMN IF NOT EXISTS answers TEXT`,
  `ALTER TABLE lead_audits ADD COLUMN IF NOT EXISTS prev_plan_status TEXT`,
  `ALTER TABLE lead_audits ADD COLUMN IF NOT EXISTS prev_plan_note TEXT`,
  `CREATE TABLE IF NOT EXISTS audits (
    id SERIAL PRIMARY KEY,
    title TEXT,
    audit_date TEXT NOT NULL,
    period_start TEXT,
    scope TEXT NOT NULL DEFAULT 'all',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_closed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS audit_targets (
    id SERIAL PRIMARY KEY,
    audit_id INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    UNIQUE (audit_id, lead_id)
  )`,
  `CREATE TABLE IF NOT EXISTS audit_responses (
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
  )`,
  `ALTER TABLE lead_updates ADD COLUMN IF NOT EXISTS email_submission_id INTEGER REFERENCES email_submissions(id) ON DELETE SET NULL`,
  `ALTER TABLE leads ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT NULL`,
  `ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action TEXT DEFAULT NULL`,
  `ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action_due TEXT DEFAULT NULL`,
  `ALTER TABLE leads ADD COLUMN IF NOT EXISTS expected_close TEXT DEFAULT NULL`,
  `ALTER TABLE leads ADD COLUMN IF NOT EXISTS category TEXT DEFAULT NULL`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ DEFAULT NULL`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_seen_at TIMESTAMPTZ DEFAULT NOW()`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS whats_new_seen INTEGER NOT NULL DEFAULT 0`,
  `CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage)`,
  `CREATE INDEX IF NOT EXISTS idx_leads_deleted ON leads(deleted_at)`,
  `CREATE INDEX IF NOT EXISTS idx_updates_lead ON lead_updates(lead_id)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_events_date ON calendar_events(event_date)`,
  `CREATE INDEX IF NOT EXISTS idx_submissions_user ON email_submissions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_submissions_assigned ON email_submissions(assigned_to)`,
  `CREATE INDEX IF NOT EXISTS idx_features_user ON feature_requests(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_feature_comments_req ON feature_request_comments(request_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_lead ON tasks(lead_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date)`,
  `CREATE INDEX IF NOT EXISTS idx_audits_cycle ON lead_audits(cycle_start)`,
  `CREATE INDEX IF NOT EXISTS idx_audits_lead ON lead_audits(lead_id)`,
  `CREATE TABLE IF NOT EXISTS email_accounts (
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
  )`,
  `ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS signature TEXT`,
  `ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS autopilot_master INTEGER NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS email_threads (
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
  )`,
  `CREATE TABLE IF NOT EXISTS email_messages (
    id SERIAL PRIMARY KEY,
    thread_id INTEGER NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    direction TEXT NOT NULL,
    from_addr TEXT, from_name TEXT, to_addr TEXT,
    subject TEXT, body_text TEXT,
    message_id TEXT, in_reply_to TEXT,
    imap_uid INTEGER, sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS email_outbox (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    thread_id INTEGER REFERENCES email_threads(id) ON DELETE SET NULL,
    to_addr TEXT NOT NULL, subject TEXT, body TEXT NOT NULL,
    send_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS signature TEXT`,
  `ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS autopilot_master INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS include_signature INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS autopilot_mode TEXT DEFAULT 'review'`,
  `ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS autopilot_voice TEXT DEFAULT 'Friendly'`,
  `ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS autopilot_hours TEXT DEFAULT 'business'`,
  `ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS autopilot_handback INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE email_threads ADD COLUMN IF NOT EXISTS summary TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_email_threads_user ON email_threads(user_id, last_message_at)`,
  `CREATE INDEX IF NOT EXISTS idx_email_messages_thread ON email_messages(thread_id)`,
  `CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    scope TEXT NOT NULL DEFAULT 'personal',
    name TEXT NOT NULL,
    mime TEXT, size INTEGER,
    data TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_files_scope ON files(scope)`,
  `CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_targets_audit ON audit_targets(audit_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_targets_lead ON audit_targets(lead_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_responses_audit ON audit_responses(audit_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_responses_lead ON audit_responses(lead_id)`,
];

async function main() {
  for (const stmt of SCHEMA) await sql(stmt, []);

  const existing = await sql('SELECT id FROM users WHERE email=$1', ['admin@company.com']);
  if (existing.length === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await sql('INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4)', ['Admin', 'admin@company.com', hash, 'admin']);
    console.log('✅ Admin created: admin@company.com / admin123');
  } else {
    console.log('ℹ️  Admin already exists');
  }

  const defaults = [['company_name','My Company'],['currency','USD'],['timezone','America/New_York'],['accent_color','indigo'],['next_action_presets', JSON.stringify(['Call to follow up','Send proposal','Send a quote','Schedule a meeting','Negotiate terms','Send samples','Wait for their reply','Check in'])],['lead_categories', JSON.stringify(['National Stores','National Distributors','Local'])]];
  for (const [k,v] of defaults) {
    await sql('INSERT INTO app_settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING', [k, v]);
  }

  console.log('✅ Database ready (Neon Postgres)');
}

main().catch(e => { console.error(e); process.exit(1); });
