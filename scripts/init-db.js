const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

async function main() {
  const db = createClient({ url: `file:${path.join(dataDir, 'sales.db')}` });

  await db.executeMultiple(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'salesman', is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT, company_name TEXT NOT NULL,
      contact_name TEXT, contact_email TEXT, contact_phone TEXT,
      stage TEXT NOT NULL DEFAULT 'new', assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      source TEXT NOT NULL DEFAULT 'manual', notes TEXT, value TEXT DEFAULT NULL,
      deleted_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS lead_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      content TEXT NOT NULL, stage_from TEXT, stage_to TEXT,
      source TEXT NOT NULL DEFAULT 'manual', email_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      subject TEXT NOT NULL, body TEXT NOT NULL,
      lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
      title TEXT NOT NULL, description TEXT,
      event_date TEXT NOT NULL, event_time TEXT,
      type TEXT NOT NULL DEFAULT 'Meeting',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
    CREATE INDEX IF NOT EXISTS idx_leads_deleted ON leads(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_updates_lead ON lead_updates(lead_id);
    CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_user_id);
    CREATE INDEX IF NOT EXISTS idx_events_date ON calendar_events(event_date);
  `);

  const existing = await db.execute({ sql: `SELECT id FROM users WHERE email=?`, args: ['admin@company.com'] });
  if (existing.rows.length === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await db.execute({ sql: `INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)`, args: ['Admin', 'admin@company.com', hash, 'admin'] });
    console.log('✅ Admin created: admin@company.com / admin123');
  } else {
    console.log('ℹ️  Admin already exists');
  }

  const settingsDefaults = [['company_name','My Company'],['currency','USD'],['timezone','America/New_York'],['accent_color','indigo']];
  for (const [k,v] of settingsDefaults) {
    await db.execute({ sql: `INSERT OR IGNORE INTO app_settings (key,value) VALUES (?,?)`, args: [k,v] });
  }

  console.log('✅ Database ready at', path.join(dataDir, 'sales.db'));
}

main().catch(e => { console.error(e); process.exit(1); });
