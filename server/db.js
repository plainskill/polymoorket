import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : path.join(process.cwd(), 'data'));
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, 'polymoorket.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  active INTEGER NOT NULL DEFAULT 1,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS group_members (
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);
CREATE TABLE IF NOT EXISTS markets (
  id INTEGER PRIMARY KEY,
  number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  visibility TEXT NOT NULL DEFAULT 'all',
  winning_outcome_id INTEGER,
  resolution_note TEXT DEFAULT '',
  closes_at TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS outcomes (
  id INTEGER PRIMARY KEY,
  market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS market_users (
  market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (market_id, user_id)
);
CREATE TABLE IF NOT EXISTS market_groups (
  market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (market_id, group_id)
);
CREATE TABLE IF NOT EXISTS bets (
  id INTEGER PRIMARY KEY,
  market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  outcome_id INTEGER NOT NULL REFERENCES outcomes(id),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  kind TEXT NOT NULL,
  ref TEXT DEFAULT '',
  note TEXT DEFAULT '',
  balance_after INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS market_suggestions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  outcomes TEXT NOT NULL DEFAULT '["Yes","No"]',
  explanation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS resolution_suggestions (
  id INTEGER PRIMARY KEY,
  market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  outcome_id INTEGER NOT NULL REFERENCES outcomes(id),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  explanation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, hash) {
  const candidate = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

export function credit(userId, amount, kind, ref = '', note = '') {
  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, userId);
  const { balance } = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
  db.prepare('INSERT INTO ledger (user_id, amount, kind, ref, note, balance_after) VALUES (?,?,?,?,?,?)')
    .run(userId, amount, kind, ref, note, balance);
  return balance;
}

// ---------- bootstrap ----------
const userCount = db.prepare('SELECT COUNT(*) c FROM users').get().c;
if (userCount === 0) {
  const pw = process.env.ADMIN_PASSWORD || crypto.randomBytes(6).toString('hex');
  const { salt, hash } = hashPassword(pw);
  const info = db.prepare(
    `INSERT INTO users (username, pass_hash, salt, role, balance) VALUES ('admin', ?, ?, 'admin', 0)`
  ).run(hash, salt);
  console.log(`[polymoorket] created admin account — username "admin", password: ${pw}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log('[polymoorket] random admin password (see above). Set ADMIN_PASSWORD env to choose your own.');
  }

  // First-run seed moorkets so the book isn't empty.
  const seed = db.prepare(`INSERT INTO markets (number, title, description, created_by) VALUES (?,?,?,?)`);
  const out = db.prepare(`INSERT INTO outcomes (market_id, label, sort) VALUES (?,?,?)`);
  const seeds = [
    ['MKT 001', 'Will it rain this weekend?', 'Resolves YES if measurable rain falls within the parish boundary between Friday 00:00 and Sunday 23:59. The trig point gauge is canonical.'],
    ['MKT 002', 'Does the beet harvest beat last year?', 'Total tonnage from the lower field, weighed at the barn scale, versus last year\'s recorded 4.2 tonnes.'],
    ['MKT 003', 'Will anyone bring up polymoorket at dinner before Sunday?', 'Any unprompted mention of the site, the markets, or beetcoin counts. Prompting voids the bet and the bettor\'s honour.'],
  ];
  for (const [num, title, desc] of seeds) {
    const m = seed.run(num, title, desc, info.lastInsertRowid);
    out.run(m.lastInsertRowid, 'Yes', 0);
    out.run(m.lastInsertRowid, 'No', 1);
  }
}
