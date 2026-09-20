import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db, hashPassword, verifyPassword, credit } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(cookieParser());
app.set('trust proxy', true);

// ---------- auth ----------
const COOKIE = 'pmk_session';

function createSession(userId, res) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?, datetime('now','+30 days'))`)
    .run(token, userId);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 864e5, secure: 'auto' });
}

function getUser(req) {
  const token = req.cookies[COOKIE];
  if (!token) return null;
  const row = db.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > datetime('now') AND u.active = 1`
  ).get(token);
  return row || null;
}

function requireUser(req, res, next) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not logged in' });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  const user = getUser(req);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  req.user = user;
  next();
}

// ---------- helpers ----------
const poolStmt = db.prepare(
  `SELECT o.id, o.label, o.sort, COALESCE(SUM(b.amount),0) pool,
          COALESCE(SUM(CASE WHEN b.user_id = ? THEN b.amount END),0) my_stake
   FROM outcomes o LEFT JOIN bets b ON b.outcome_id = o.id
   WHERE o.market_id = ? GROUP BY o.id ORDER BY o.sort, o.id`
);

function marketVisibleTo(marketId, user) {
  if (user.role === 'admin') return true;
  const m = db.prepare('SELECT visibility FROM markets WHERE id = ?').get(marketId);
  if (!m) return false;
  if (m.visibility === 'all') return true;
  const direct = db.prepare('SELECT 1 FROM market_users WHERE market_id = ? AND user_id = ?').get(marketId, user.id);
  if (direct) return true;
  const viaGroup = db.prepare(
    `SELECT 1 FROM market_groups mg JOIN group_members gm ON gm.group_id = mg.group_id
     WHERE mg.market_id = ? AND gm.user_id = ?`
  ).get(marketId, user.id);
  return !!viaGroup;
}

function shapeMarket(m, user) {
  const outcomes = poolStmt.all(user.id, m.id);
  const total = outcomes.reduce((s, o) => s + o.pool, 0);
  const bettors = db.prepare('SELECT COUNT(DISTINCT user_id) c FROM bets WHERE market_id = ?').get(m.id).c;
  return {
    id: m.id, number: m.number, title: m.title, description: m.description,
    status: m.status, visibility: m.visibility, closes_at: m.closes_at,
    created_at: m.created_at, resolved_at: m.resolved_at, resolution_note: m.resolution_note,
    winning_outcome_id: m.winning_outcome_id, total_pool: total, bettors,
    outcomes: outcomes.map(o => ({
      ...o,
      implied: total > 0 ? o.pool / total : null,
      odds: o.pool > 0 ? total / o.pool : null, // return multiple per beetcoin staked
    })),
  };
}

function visibleMarkets(user) {
  const all = db.prepare('SELECT * FROM markets ORDER BY created_at DESC, id DESC').all();
  return all.filter(m => marketVisibleTo(m.id, user)).map(m => shapeMarket(m, user));
}

// ---------- public (auth) ----------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username).trim());
  if (!user || !verifyPassword(String(password), user.salt, user.pass_hash)) {
    return res.status(401).json({ error: 'Wrong username or password' });
  }
  if (!user.active) return res.status(403).json({ error: 'Account deactivated — ask the admin' });
  createSession(user.id, res);
  res.json({ user: publicUser(user) });
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies[COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

const publicUser = u => ({ id: u.id, username: u.username, role: u.role, balance: u.balance });

app.get('/api/me', requireUser, (req, res) => res.json({ user: publicUser(req.user) }));

// ---------- moorkets ----------
app.get('/api/markets', requireUser, (req, res) => {
  res.json({ markets: visibleMarkets(req.user) });
});

app.get('/api/markets/:id', requireUser, (req, res) => {
  const m = db.prepare('SELECT * FROM markets WHERE id = ?').get(req.params.id);
  if (!m || !marketVisibleTo(m.id, req.user)) return res.status(404).json({ error: 'Moorket not found' });
  const bets = db.prepare(
    `SELECT b.id, b.amount, b.created_at, b.outcome_id, u.username
     FROM bets b JOIN users u ON u.id = b.user_id WHERE b.market_id = ? ORDER BY b.created_at DESC`
  ).all(m.id);
  const suggestions = db.prepare(
    `SELECT r.id, r.explanation, r.status, r.created_at, r.outcome_id, u.username, o.label outcome_label
     FROM resolution_suggestions r JOIN users u ON u.id = r.user_id JOIN outcomes o ON o.id = r.outcome_id
     WHERE r.market_id = ? ORDER BY r.created_at DESC`
  ).all(m.id);
  res.json({ market: shapeMarket(m, req.user), bets, resolution_suggestions: suggestions });
});

app.post('/api/markets/:id/bets', requireUser, (req, res) => {
  const m = db.prepare('SELECT * FROM markets WHERE id = ?').get(req.params.id);
  if (!m || !marketVisibleTo(m.id, req.user)) return res.status(404).json({ error: 'Moorket not found' });
  if (m.status !== 'open') return res.status(409).json({ error: `This moorket is ${m.status}` });
  if (m.closes_at && new Date(m.closes_at) < new Date()) return res.status(409).json({ error: 'This moorket has closed' });
  const amount = Math.floor(Number(req.body?.amount));
  const outcomeId = Number(req.body?.outcome_id);
  if (!Number.isInteger(amount) || amount <= 0) return res.status(400).json({ error: 'Stake must be a positive whole number of beetcoin' });
  const outcome = db.prepare('SELECT id FROM outcomes WHERE id = ? AND market_id = ?').get(outcomeId, m.id);
  if (!outcome) return res.status(400).json({ error: 'Unknown outcome' });
  if (req.user.balance < amount) return res.status(402).json({ error: `Not enough beetcoin — you have ${req.user.balance}` });

  const place = db.transaction(() => {
    credit(req.user.id, -amount, 'stake', m.number, `${m.title}`);
    db.prepare('INSERT INTO bets (market_id, outcome_id, user_id, amount) VALUES (?,?,?,?)')
      .run(m.id, outcomeId, req.user.id, amount);
  });
  place();
  res.json({ ok: true, balance: req.user.balance - amount });
});

app.post('/api/markets/:id/suggest-resolution', requireUser, (req, res) => {
  const m = db.prepare('SELECT * FROM markets WHERE id = ?').get(req.params.id);
  if (!m || !marketVisibleTo(m.id, req.user)) return res.status(404).json({ error: 'Moorket not found' });
  const outcomeId = Number(req.body?.outcome_id);
  const explanation = String(req.body?.explanation || '').trim();
  if (!explanation) return res.status(400).json({ error: 'An explanation is required' });
  const outcome = db.prepare('SELECT id FROM outcomes WHERE id = ? AND market_id = ?').get(outcomeId, m.id);
  if (!outcome) return res.status(400).json({ error: 'Unknown outcome' });
  db.prepare('INSERT INTO resolution_suggestions (market_id, outcome_id, user_id, explanation) VALUES (?,?,?,?)')
    .run(m.id, outcomeId, req.user.id, explanation);
  res.json({ ok: true });
});

// ---------- portfolio / ledger / suggestions ----------
app.get('/api/portfolio', requireUser, (req, res) => {
  const positions = db.prepare(
    `SELECT b.outcome_id, o.label outcome_label, o.market_id, SUM(b.amount) staked
     FROM bets b JOIN outcomes o ON o.id = b.outcome_id
     WHERE b.user_id = ? GROUP BY b.outcome_id`
  ).all(req.user.id);
  const out = positions.map(p => {
    const m = db.prepare('SELECT * FROM markets WHERE id = ?').get(p.market_id);
    return { ...p, market: shapeMarket(m, req.user) };
  });
  res.json({ positions: out });
});

app.get('/api/ledger', requireUser, (req, res) => {
  res.json({ entries: db.prepare('SELECT * FROM ledger WHERE user_id = ? ORDER BY id DESC LIMIT 200').all(req.user.id) });
});

app.get('/api/leaderboard', requireUser, (req, res) => {
  const rows = db.prepare(
    `SELECT id, username, balance FROM users WHERE active = 1 ORDER BY balance DESC`
  ).all();
  res.json({ leaderboard: rows });
});

app.post('/api/suggestions/market', requireUser, (req, res) => {
  const title = String(req.body?.title || '').trim();
  const description = String(req.body?.description || '').trim();
  const explanation = String(req.body?.explanation || '').trim();
  let outcomes = Array.isArray(req.body?.outcomes) ? req.body.outcomes.map(o => String(o).trim()).filter(Boolean) : [];
  if (!title || !explanation) return res.status(400).json({ error: 'Title and explanation are required' });
  if (outcomes.length === 0) outcomes = ['Yes', 'No'];
  if (outcomes.length < 2) return res.status(400).json({ error: 'A moorket needs at least two outcomes' });
  if (outcomes.length > 8) return res.status(400).json({ error: 'Eight outcomes is plenty' });
  db.prepare('INSERT INTO market_suggestions (user_id, title, description, outcomes, explanation) VALUES (?,?,?,?,?)')
    .run(req.user.id, title, description, JSON.stringify(outcomes), explanation);
  res.json({ ok: true });
});

app.get('/api/suggestions/mine', requireUser, (req, res) => {
  const markets = db.prepare('SELECT * FROM market_suggestions WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  const resolutions = db.prepare(
    `SELECT r.*, m.title market_title, o.label outcome_label
     FROM resolution_suggestions r JOIN markets m ON m.id = r.market_id JOIN outcomes o ON o.id = r.outcome_id
     WHERE r.user_id = ? ORDER BY r.id DESC`
  ).all(req.user.id);
  res.json({ market_suggestions: markets, resolution_suggestions: resolutions });
});

// ---------- admin ----------
app.get('/api/admin/overview', requireAdmin, (req, res) => {
  res.json({
    users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
    markets: db.prepare('SELECT COUNT(*) c FROM markets').get().c,
    open: db.prepare(`SELECT COUNT(*) c FROM markets WHERE status = 'open'`).get().c,
    beetcoin_in_circulation: db.prepare('SELECT COALESCE(SUM(balance),0) s FROM users').get().s
      + db.prepare(`SELECT COALESCE(SUM(amount),0) s FROM bets b JOIN markets m ON m.id=b.market_id WHERE m.status='open'`).get().s,
    pending_suggestions: db.prepare(`SELECT (SELECT COUNT(*) FROM market_suggestions WHERE status='pending') + (SELECT COUNT(*) FROM resolution_suggestions WHERE status='pending') c`).get().c,
  });
});

// users
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, role, active, balance, created_at FROM users ORDER BY username').all();
  const groups = db.prepare('SELECT * FROM groups ORDER BY name').all();
  const members = db.prepare(
    `SELECT gm.group_id, gm.user_id, u.username FROM group_members gm JOIN users u ON u.id = gm.user_id`
  ).all();
  res.json({ users, groups, members });
});

app.post('/api/admin/users', requireAdmin, (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const balance = Math.max(0, Math.floor(Number(req.body?.balance ?? 100)));
  const role = req.body?.role === 'admin' ? 'admin' : 'user';
  if (!username || username.length > 32) return res.status(400).json({ error: 'Username required (max 32 chars)' });
  if (password.length < 4) return res.status(400).json({ error: 'Password needs at least 4 characters' });
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) return res.status(409).json({ error: 'Username taken' });
  const { salt, hash } = hashPassword(password);
  const info = db.prepare('INSERT INTO users (username, pass_hash, salt, role, balance) VALUES (?,?,?,?,0)')
    .run(username, hash, salt, role);
  if (balance > 0) credit(info.lastInsertRowid, balance, 'grant', '', 'opening stake');
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.patch('/api/admin/users/:id', requireAdmin, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { active, password, adjust, role } = req.body || {};
  if (active !== undefined) db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, u.id);
  if (role !== undefined && (role === 'admin' || role === 'user')) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, u.id);
  if (password) {
    if (String(password).length < 4) return res.status(400).json({ error: 'Password needs at least 4 characters' });
    const { salt, hash } = hashPassword(String(password));
    db.prepare('UPDATE users SET pass_hash = ?, salt = ? WHERE id = ?').run(hash, salt, u.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  }
  if (adjust !== undefined) {
    const amt = Math.floor(Number(adjust));
    if (amt !== 0) credit(u.id, amt, 'adjustment', '', String(req.body.note || 'admin adjustment'));
  }
  res.json({ ok: true });
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (u.id === req.user.id) return res.status(409).json({ error: 'You can\'t delete yourself — bar yourself instead' });
  if (u.role === 'admin' && db.prepare(`SELECT COUNT(*) c FROM users WHERE role='admin'`).get().c <= 1) {
    return res.status(409).json({ error: 'Can\'t delete the last admin' });
  }
  const del = db.transaction(() => {
    // moorkets survive their creator; suggestions, slips, ledger, sessions cascade
    db.prepare('UPDATE markets SET created_by = NULL WHERE created_by = ?').run(u.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
  });
  del();
  res.json({ ok: true });
});

// groups
app.post('/api/admin/groups', requireAdmin, (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Group name required' });
  try {
    const info = db.prepare('INSERT INTO groups (name) VALUES (?)').run(name);
    res.json({ ok: true, id: info.lastInsertRowid });
  } catch { res.status(409).json({ error: 'Group exists' }); }
});

app.delete('/api/admin/groups/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM groups WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/admin/groups/:id/members', requireAdmin, (req, res) => {
  const { user_id, remove } = req.body || {};
  if (remove) db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(req.params.id, user_id);
  else db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?,?)').run(req.params.id, user_id);
  res.json({ ok: true });
});

// markets
function nextNumber() {
  const row = db.prepare(`SELECT number FROM markets ORDER BY CAST(substr(number, 5) AS INTEGER) DESC LIMIT 1`).get();
  const n = row ? parseInt(row.number.slice(4), 10) + 1 : 1;
  return `MKT ${String(n).padStart(3, '0')}`;
}

app.get('/api/admin/markets', requireAdmin, (req, res) => {
  const all = db.prepare('SELECT * FROM markets ORDER BY id DESC').all();
  const shaped = all.map(m => {
    const s = shapeMarket(m, req.user);
    s.allowed_users = db.prepare('SELECT u.id, u.username FROM market_users mu JOIN users u ON u.id=mu.user_id WHERE mu.market_id=?').all(m.id);
    s.allowed_groups = db.prepare('SELECT g.id, g.name FROM market_groups mg JOIN groups g ON g.id=mg.group_id WHERE mg.market_id=?').all(m.id);
    return s;
  });
  res.json({ markets: shaped });
});

app.post('/api/admin/markets', requireAdmin, (req, res) => {
  const title = String(req.body?.title || '').trim();
  const description = String(req.body?.description || '').trim();
  let outcomes = Array.isArray(req.body?.outcomes) ? req.body.outcomes.map(o => String(o).trim()).filter(Boolean) : ['Yes', 'No'];
  const visibility = req.body?.visibility === 'restricted' ? 'restricted' : 'all';
  const userIds = Array.isArray(req.body?.user_ids) ? req.body.user_ids : [];
  const groupIds = Array.isArray(req.body?.group_ids) ? req.body.group_ids : [];
  if (!title) return res.status(400).json({ error: 'Title required' });
  if (outcomes.length < 2) return res.status(400).json({ error: 'At least two outcomes' });

  const create = db.transaction(() => {
    const info = db.prepare(
      `INSERT INTO markets (number, title, description, visibility, created_by, closes_at)
       VALUES (?,?,?,?,?,?)`
    ).run(nextNumber(), title, description, visibility, req.user.id, req.body?.closes_at || null);
    const mid = info.lastInsertRowid;
    outcomes.forEach((label, i) => db.prepare('INSERT INTO outcomes (market_id, label, sort) VALUES (?,?,?)').run(mid, label, i));
    if (visibility === 'restricted') {
      userIds.forEach(uid => db.prepare('INSERT OR IGNORE INTO market_users (market_id, user_id) VALUES (?,?)').run(mid, uid));
      groupIds.forEach(gid => db.prepare('INSERT OR IGNORE INTO market_groups (market_id, group_id) VALUES (?,?)').run(mid, gid));
    }
    return mid;
  });
  res.json({ ok: true, id: create() });
});

app.patch('/api/admin/markets/:id', requireAdmin, (req, res) => {
  const m = db.prepare('SELECT * FROM markets WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Moorket not found' });
  const { title, description, visibility, status, closes_at, user_ids, group_ids } = req.body || {};
  if (title !== undefined) db.prepare('UPDATE markets SET title = ? WHERE id = ?').run(String(title), m.id);
  if (description !== undefined) db.prepare('UPDATE markets SET description = ? WHERE id = ?').run(String(description), m.id);
  if (closes_at !== undefined) db.prepare('UPDATE markets SET closes_at = ? WHERE id = ?').run(closes_at || null, m.id);
  if (status !== undefined && ['open', 'locked'].includes(status) && m.status !== 'resolved' && m.status !== 'cancelled')
    db.prepare('UPDATE markets SET status = ? WHERE id = ?').run(status, m.id);
  if (visibility !== undefined && ['all', 'restricted'].includes(visibility))
    db.prepare('UPDATE markets SET visibility = ? WHERE id = ?').run(visibility, m.id);
  if (user_ids !== undefined) {
    db.prepare('DELETE FROM market_users WHERE market_id = ?').run(m.id);
    user_ids.forEach(uid => db.prepare('INSERT OR IGNORE INTO market_users (market_id, user_id) VALUES (?,?)').run(m.id, uid));
  }
  if (group_ids !== undefined) {
    db.prepare('DELETE FROM market_groups WHERE market_id = ?').run(m.id);
    group_ids.forEach(gid => db.prepare('INSERT OR IGNORE INTO market_groups (market_id, group_id) VALUES (?,?)').run(m.id, gid));
  }
  res.json({ ok: true });
});

// pari-mutuel resolution: winners split the total pool pro-rata
app.post('/api/admin/markets/:id/resolve', requireAdmin, (req, res) => {
  const m = db.prepare('SELECT * FROM markets WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Moorket not found' });
  if (m.status === 'resolved' || m.status === 'cancelled') return res.status(409).json({ error: `Already ${m.status}` });
  const outcomeId = Number(req.body?.outcome_id);
  const note = String(req.body?.note || '').trim();
  const asOf = req.body?.as_of ? String(req.body.as_of) : null;
  const outcome = db.prepare('SELECT * FROM outcomes WHERE id = ? AND market_id = ?').get(outcomeId, m.id);
  if (!outcome) return res.status(400).json({ error: 'Unknown outcome' });
  if (asOf && isNaN(new Date(asOf))) return res.status(400).json({ error: 'Bad as_of time' });

  const resolve = db.transaction(() => {
    if (asOf) {
      // stakes placed after the cutoff never happened — erase and refund
      const late = db.prepare(
        `SELECT id, user_id, amount FROM bets WHERE market_id = ? AND datetime(created_at) > datetime(?)`
      ).all(m.id, asOf);
      for (const b of late) credit(b.user_id, b.amount, 'refund', m.number, `${m.title} — staked after cutoff, erased`);
      db.prepare(`DELETE FROM bets WHERE market_id = ? AND datetime(created_at) > datetime(?)`).run(m.id, asOf);
    }
    const bets = db.prepare('SELECT user_id, SUM(amount) staked FROM bets WHERE market_id = ? GROUP BY user_id').all(m.id);
    const total = bets.reduce((s, b) => s + b.staked, 0);
    const winning = bets.filter(b => db.prepare('SELECT 1 FROM bets WHERE market_id=? AND outcome_id=? AND user_id=?')
      .get(m.id, outcomeId, b.user_id));

    if (total > 0) {
      const winPool = db.prepare('SELECT COALESCE(SUM(amount),0) s FROM bets WHERE market_id=? AND outcome_id=?').get(m.id, outcomeId).s;
      if (winPool === 0) {
        // nobody backed the winner — refund everyone
        for (const b of bets) credit(b.user_id, b.staked, 'refund', m.number, `${m.title} — nobody backed the winner`);
      } else {
        // distribute total pool pro-rata with largest-remainder rounding
        const winBets = db.prepare('SELECT user_id, SUM(amount) staked FROM bets WHERE market_id=? AND outcome_id=? GROUP BY user_id').all(m.id, outcomeId);
        const shares = winBets.map(b => ({ user_id: b.user_id, exact: (b.staked * total) / winPool }));
        let distributed = 0;
        const floored = shares.map(s => ({ ...s, payout: Math.floor(s.exact) }));
        floored.forEach(s => distributed += s.payout);
        floored.sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)));
        for (let i = 0; i < total - distributed; i++) floored[i % floored.length].payout++;
        for (const s of floored) credit(s.user_id, s.payout, 'payout', m.number, `${m.title} → ${outcome.label}`);
      }
    }
    db.prepare(`UPDATE markets SET status='resolved', winning_outcome_id=?, resolution_note=?, resolved_at=datetime('now') WHERE id=?`)
      .run(outcomeId, note, m.id);
    db.prepare(`UPDATE resolution_suggestions SET status='superseded' WHERE market_id=? AND status='pending'`).run(m.id);
  });
  resolve();
  res.json({ ok: true });
});

app.post('/api/admin/markets/:id/cancel', requireAdmin, (req, res) => {
  const m = db.prepare('SELECT * FROM markets WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Moorket not found' });
  if (m.status === 'resolved' || m.status === 'cancelled') return res.status(409).json({ error: `Already ${m.status}` });
  const cancel = db.transaction(() => {
    const bets = db.prepare('SELECT user_id, SUM(amount) staked FROM bets WHERE market_id=? GROUP BY user_id').all(m.id);
    for (const b of bets) credit(b.user_id, b.staked, 'refund', m.number, `${m.title} — cancelled`);
    db.prepare(`UPDATE markets SET status='cancelled', resolution_note=?, resolved_at=datetime('now') WHERE id=?`)
      .run(String(req.body?.note || ''), m.id);
    db.prepare(`UPDATE resolution_suggestions SET status='superseded' WHERE market_id=? AND status='pending'`).run(m.id);
  });
  cancel();
  res.json({ ok: true });
});

// suggestions review
app.get('/api/admin/suggestions', requireAdmin, (req, res) => {
  const markets = db.prepare(
    `SELECT s.*, u.username FROM market_suggestions s JOIN users u ON u.id = s.user_id ORDER BY s.id DESC`
  ).all();
  const resolutions = db.prepare(
    `SELECT r.*, u.username, m.title market_title, m.number market_number, o.label outcome_label, m.status market_status
     FROM resolution_suggestions r
     JOIN users u ON u.id = r.user_id JOIN markets m ON m.id = r.market_id JOIN outcomes o ON o.id = r.outcome_id
     ORDER BY r.id DESC`
  ).all();
  res.json({ market_suggestions: markets, resolution_suggestions: resolutions });
});

app.post('/api/admin/suggestions/market/:id', requireAdmin, (req, res) => {
  const s = db.prepare('SELECT * FROM market_suggestions WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  const action = req.body?.action;
  const note = String(req.body?.note || '');
  if (action === 'approve') {
    const outcomes = JSON.parse(s.outcomes);
    const create = db.transaction(() => {
      const info = db.prepare(
        `INSERT INTO markets (number, title, description, visibility, created_by) VALUES (?,?,?,'all',?)`
      ).run(nextNumber(), s.title, s.description, s.user_id);
      outcomes.forEach((label, i) => db.prepare('INSERT INTO outcomes (market_id, label, sort) VALUES (?,?,?)').run(info.lastInsertRowid, label, i));
      db.prepare(`UPDATE market_suggestions SET status='approved', admin_note=? WHERE id=?`).run(note, s.id);
      return info.lastInsertRowid;
    });
    res.json({ ok: true, market_id: create() });
  } else if (action === 'dismiss') {
    db.prepare(`UPDATE market_suggestions SET status='dismissed', admin_note=? WHERE id=?`).run(note, s.id);
    res.json({ ok: true });
  } else res.status(400).json({ error: 'action must be approve or dismiss' });
});

app.post('/api/admin/suggestions/resolution/:id', requireAdmin, (req, res) => {
  const s = db.prepare('SELECT * FROM resolution_suggestions WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  const action = req.body?.action;
  const note = String(req.body?.note || '');
  if (action === 'dismiss') {
    db.prepare(`UPDATE resolution_suggestions SET status='dismissed', admin_note=? WHERE id=?`).run(note, s.id);
    return res.json({ ok: true });
  }
  if (action === 'accept') {
    // mark noted; actual resolution goes through /resolve so payout logic isn't duplicated
    db.prepare(`UPDATE resolution_suggestions SET status='accepted', admin_note=? WHERE id=?`).run(note, s.id);
    return res.json({ ok: true });
  }
  res.status(400).json({ error: 'action must be accept or dismiss' });
});

// ---------- static ----------
const dist = path.join(__dirname, '..', 'web', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  app.get('/', (req, res) => res.send('polymoorket API up — build the frontend (web/) to serve the app'));
}

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`[polymoorket] listening on :${port}`));
