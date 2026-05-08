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
  `ALTER TABLE lead_updates ADD COLUMN IF NOT EXISTS email_submission_id INTEGER REFERENCES email_submissions(id) ON DELETE SET NULL`,
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

  const defaults = [['company_name','My Company'],['currency','USD'],['timezone','America/New_York'],['accent_color','indigo']];
  for (const [k,v] of defaults) {
    await sql('INSERT INTO app_settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING', [k, v]);
  }

  console.log('✅ Database ready (Neon Postgres)');
}

main().catch(e => { console.error(e); process.exit(1); });
