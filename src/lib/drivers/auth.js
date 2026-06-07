import crypto from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { getPostgresUrl, isPostgres, isSqlite } from './engine.js';

const DATA_DIR = path.join(process.cwd(), '.data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const PERMS_FILE = path.join(DATA_DIR, 'permissions.json');

const AUTH_MIGRATIONS = {
  [USERS_FILE]: (u) => {
    let c = false;
    if (u.name === undefined) {
      u.name = null;
      c = true;
    }
    if (u.role === undefined) {
      u.role = 'user';
      c = true;
    }
    if (u.created_at === undefined) {
      u.created_at = new Date().toISOString();
      c = true;
    }
    return c;
  },
  [SESSIONS_FILE]: (s) => {
    let c = false;
    if (s.userId !== undefined && s.user_id === undefined) {
      s.user_id = s.userId;
      c = true;
    }
    if (s.user_id === undefined) {
      s.user_id = null;
      c = true;
    }
    if (s.created_at === undefined) {
      s.created_at = new Date().toISOString();
      c = true;
    }
    return c;
  },
  [PERMS_FILE]: (p) => {
    let c = false;
    if (p.email === undefined) {
      p.email = null;
      c = true;
    }
    if (p.permission === undefined) {
      p.permission = 'view';
      c = true;
    }
    return c;
  },
};

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function ensureJSON(file, initial) {
  await ensureDir();
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, JSON.stringify(initial, null, 2), 'utf-8');
  }
}

async function readJSON(file) {
  await ensureJSON(file, []);
  const raw = await fs.readFile(file, 'utf-8');
  if (!raw.trim()) return [];
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const migrate = AUTH_MIGRATIONS[file];
  if (migrate) {
    let changed = false;
    for (const item of data) {
      if (migrate(item)) changed = true;
    }
    if (changed) await writeJSON(file, data);
  }
  return data;
}

async function writeJSON(file, data) {
  await ensureJSON(file, []);
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Postgres helpers ───────────────────────────────

let poolPromise = null;
async function getPool() {
  if (!poolPromise) {
    const { createPool } = await import('@vercel/postgres');
    poolPromise = createPool({ connectionString: getPostgresUrl() });
  }
  return poolPromise;
}

async function withClient(fn) {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

// ─── SQLite helpers ─────────────────────────────────

let sqliteDb = null;
function getSqliteDb() {
  if (sqliteDb) return sqliteDb;
  if (!fsSync.existsSync(DATA_DIR)) fsSync.mkdirSync(DATA_DIR, { recursive: true });
  sqliteDb = new Database(path.join(DATA_DIR, 'esign.db'));
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');
  // Auto-create auth tables
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS document_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT NOT NULL,
      user_id TEXT,
      email TEXT,
      permission TEXT DEFAULT 'view',
      UNIQUE(document_id, user_id)
    );
  `);
  return sqliteDb;
}

// ─── Init tables ────────────────────────────────────

export async function initAuthTable() {
  if (isSqlite()) {
    const d = getSqliteDb();
    d.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        role TEXT DEFAULT 'user',
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS document_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id TEXT NOT NULL,
        user_id TEXT,
        email TEXT,
        permission TEXT DEFAULT 'view',
        UNIQUE(document_id, user_id)
      );
    `);
    return;
  }
  if (!isPostgres()) return;
  await withClient(async (client) => {
    await client.sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await client.sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await client.sql`
      CREATE TABLE IF NOT EXISTS document_permissions (
        id SERIAL PRIMARY KEY,
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        user_id UUID,
        email VARCHAR(255),
        permission VARCHAR(50) DEFAULT 'view',
        UNIQUE(document_id, user_id)
      )
    `;
  });
}

export async function initAuthJSON() {
  if (isPostgres() || isSqlite()) return;
  await ensureJSON(USERS_FILE, []);
  await ensureJSON(SESSIONS_FILE, []);
  await ensureJSON(PERMS_FILE, []);
}

// ─── Users ──────────────────────────────────────────

export async function findUserByEmail(email) {
  if (isSqlite()) {
    const d = getSqliteDb();
    return d.prepare(`SELECT * FROM users WHERE email = ?`).get(email) || null;
  }
  if (isPostgres()) {
    return await withClient(async (client) => {
      const { rows } = await client.sql`SELECT * FROM users WHERE email = ${email}`;
      return rows[0] || null;
    });
  }
  const users = await readJSON(USERS_FILE);
  return users.find((u) => u.email === email) || null;
}

export async function createUser({ email, password, name, role }) {
  const existing = await findUserByEmail(email);
  if (existing) throw new Error('Email already registered');
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  if (isSqlite()) {
    const d = getSqliteDb();
    d.prepare(`INSERT INTO users (id, email, password, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      id,
      email,
      password,
      name || null,
      role || 'user',
      now,
    );
    return id;
  }
  if (isPostgres()) {
    return await withClient(async (client) => {
      const { rows } = await client.sql`
        INSERT INTO users (id, email, password, name, role, created_at) VALUES (${id}, ${email}, ${password}, ${name || null}, ${role || 'user'}, ${now})
        RETURNING id
      `;
      return rows[0].id;
    });
  }
  const users = await readJSON(USERS_FILE);
  users.push({ id, email, password, name: name || null, role: role || 'user', created_at: now });
  await writeJSON(USERS_FILE, users);
  return id;
}

export async function getUser(id) {
  if (isSqlite()) {
    const d = getSqliteDb();
    return d.prepare(`SELECT * FROM users WHERE id = ?`).get(id) || null;
  }
  if (isPostgres()) {
    return await withClient(async (client) => {
      const { rows } = await client.sql`SELECT * FROM users WHERE id = ${id}`;
      return rows[0] || null;
    });
  }
  const users = await readJSON(USERS_FILE);
  return users.find((u) => u.id === id) || null;
}

export async function getUsers() {
  if (isSqlite()) {
    const d = getSqliteDb();
    return d.prepare(`SELECT * FROM users ORDER BY created_at DESC`).all();
  }
  if (isPostgres()) {
    return await withClient(async (client) => {
      const { rows } = await client.sql`SELECT * FROM users ORDER BY created_at DESC`;
      return rows;
    });
  }
  const users = await readJSON(USERS_FILE);
  return users.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function updateUser(id, updates) {
  const allowed = new Set(['email', 'password', 'name', 'role']);
  const keys = Object.keys(updates).filter((k) => allowed.has(k));
  if (keys.length === 0) return;
  const now = new Date().toISOString();
  if (isSqlite()) {
    const d = getSqliteDb();
    const sets = keys.map((k) => `${k} = ?`);
    const values = keys.map((k) => updates[k]);
    values.push(id, now);
    d.prepare(`UPDATE users SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(...values);
    return;
  }
  if (isPostgres()) {
    return await withClient(async (client) => {
      const sets = keys.map((k, i) => `${k} = $${i + 1}`);
      const values = keys.map((k) => updates[k]);
      values.push(id);
      await client.sql.query(
        `UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${keys.length + 1}`,
        values,
      );
    });
  }
  const users = await readJSON(USERS_FILE);
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return;
  for (const k of keys) users[idx][k] = updates[k];
  users[idx].updated_at = now;
  await writeJSON(USERS_FILE, users);
}

export async function deleteUser(id) {
  if (isSqlite()) {
    const d = getSqliteDb();
    d.prepare(`DELETE FROM users WHERE id = ?`).run(id);
    return;
  }
  if (isPostgres()) {
    return await withClient(async (client) => {
      await client.sql`DELETE FROM users WHERE id = ${id}`;
    });
  }
  let users = await readJSON(USERS_FILE);
  users = users.filter((u) => u.id !== id);
  await writeJSON(USERS_FILE, users);
}

// ─── Sessions ───────────────────────────────────────

export async function createSession({ userId, token, expiresAt }) {
  const now = new Date().toISOString();
  if (isSqlite()) {
    const d = getSqliteDb();
    d.prepare(`INSERT INTO sessions (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)`).run(
      userId,
      token,
      expiresAt,
      now,
    );
    return;
  }
  if (isPostgres()) {
    return await withClient(async (client) => {
      await client.sql`
        INSERT INTO sessions (user_id, token, expires_at, created_at) VALUES (${userId}, ${token}, ${expiresAt}, ${now})
      `;
    });
  }
  const sessions = await readJSON(SESSIONS_FILE);
  sessions.push({ userId, token, expires_at: expiresAt, created_at: now });
  await writeJSON(SESSIONS_FILE, sessions);
}

export async function getSession(token) {
  if (isSqlite()) {
    const d = getSqliteDb();
    const row = d.prepare(`SELECT * FROM sessions WHERE token = ?`).get(token);
    if (!row) return null;
    const user = d.prepare(`SELECT * FROM users WHERE id = ?`).get(row.user_id);
    return user
      ? { userId: user.id, email: user.email, name: user.name, role: user.role, expires_at: row.expires_at }
      : null;
  }
  if (isPostgres()) {
    return await withClient(async (client) => {
      const { rows } = await client.sql`
        SELECT s.*, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ${token}
      `;
      if (rows.length === 0) return null;
      return {
        userId: rows[0].user_id,
        email: rows[0].email,
        name: rows[0].name,
        role: rows[0].role,
        expires_at: rows[0].expires_at,
      };
    });
  }
  const sessions = await readJSON(SESSIONS_FILE);
  const session = sessions.find((s) => s.token === token);
  if (!session) return null;
  const users = await readJSON(USERS_FILE);
  const user = users.find((u) => u.id === session.userId);
  return user
    ? { userId: user.id, email: user.email, name: user.name, role: user.role, expires_at: session.expires_at }
    : null;
}

export async function deleteSession(token) {
  if (isSqlite()) {
    const d = getSqliteDb();
    d.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
    return;
  }
  if (isPostgres()) {
    return await withClient(async (client) => {
      await client.sql`DELETE FROM sessions WHERE token = ${token}`;
    });
  }
  let sessions = await readJSON(SESSIONS_FILE);
  sessions = sessions.filter((s) => s.token !== token);
  await writeJSON(SESSIONS_FILE, sessions);
}

export async function cleanExpiredSessions() {
  const now = new Date().toISOString();
  if (isSqlite()) {
    const d = getSqliteDb();
    d.prepare(`DELETE FROM sessions WHERE expires_at < ?`).run(now);
    return;
  }
  if (isPostgres()) {
    return await withClient(async (client) => {
      await client.sql`DELETE FROM sessions WHERE expires_at < ${now}`;
    });
  }
  let sessions = await readJSON(SESSIONS_FILE);
  sessions = sessions.filter((s) => s.expires_at >= now);
  await writeJSON(SESSIONS_FILE, sessions);
}

// ─── Permissions ────────────────────────────────────

export async function grantPermission({ documentId, userId, email, permission }) {
  if (isSqlite()) {
    const d = getSqliteDb();
    d.prepare(
      `INSERT OR REPLACE INTO document_permissions (document_id, user_id, email, permission) VALUES (?, ?, ?, ?)`,
    ).run(documentId, userId || null, email || null, permission || 'view');
    return;
  }
  if (isPostgres()) {
    return await withClient(async (client) => {
      await client.sql`
        INSERT INTO document_permissions (document_id, user_id, email, permission) VALUES (${documentId}, ${userId || null}, ${email || null}, ${permission || 'view'})
        ON CONFLICT (document_id, user_id) DO UPDATE SET permission = EXCLUDED.permission
      `;
    });
  }
  const perms = await readJSON(PERMS_FILE);
  const existing = perms.findIndex((p) => p.document_id === documentId && p.user_id === userId);
  if (existing !== -1) perms[existing].permission = permission || 'view';
  else perms.push({ document_id: documentId, user_id: userId, email, permission: permission || 'view' });
  await writeJSON(PERMS_FILE, perms);
}

export async function removePermission(documentId, userId) {
  if (isSqlite()) {
    const d = getSqliteDb();
    d.prepare(`DELETE FROM document_permissions WHERE document_id = ? AND user_id = ?`).run(documentId, userId);
    return;
  }
  if (isPostgres()) {
    return await withClient(async (client) => {
      await client.sql`DELETE FROM document_permissions WHERE document_id = ${documentId} AND user_id = ${userId}`;
    });
  }
  let perms = await readJSON(PERMS_FILE);
  perms = perms.filter((p) => !(p.document_id === documentId && p.user_id === userId));
  await writeJSON(PERMS_FILE, perms);
}

export async function getPermissions(documentId) {
  if (isSqlite()) {
    const d = getSqliteDb();
    return d.prepare(`SELECT * FROM document_permissions WHERE document_id = ?`).all(documentId);
  }
  if (isPostgres()) {
    return await withClient(async (client) => {
      const { rows } = await client.sql`SELECT * FROM document_permissions WHERE document_id = ${documentId}`;
      return rows;
    });
  }
  const perms = await readJSON(PERMS_FILE);
  return perms.filter((p) => p.document_id === documentId);
}

export async function getUserPermission(documentId, userId) {
  if (isSqlite()) {
    const d = getSqliteDb();
    const row = d
      .prepare(`SELECT permission FROM document_permissions WHERE document_id = ? AND user_id = ?`)
      .get(documentId, userId);
    return row ? row.permission : null;
  }
  if (isPostgres()) {
    return await withClient(async (client) => {
      const { rows } =
        await client.sql`SELECT permission FROM document_permissions WHERE document_id = ${documentId} AND user_id = ${userId}`;
      return rows.length ? rows[0].permission : null;
    });
  }
  const perms = await readJSON(PERMS_FILE);
  const perm = perms.find((p) => p.document_id === documentId && p.user_id === userId);
  return perm ? perm.permission : null;
}

export async function getAccessibleDocuments(userId) {
  if (isSqlite()) {
    const d = getSqliteDb();
    return d.prepare(`SELECT * FROM document_permissions WHERE user_id = ?`).all(userId);
  }
  if (isPostgres()) {
    return await withClient(async (client) => {
      const { rows } = await client.sql`SELECT * FROM document_permissions WHERE user_id = ${userId}`;
      return rows;
    });
  }
  const perms = await readJSON(PERMS_FILE);
  return perms.filter((p) => p.user_id === userId);
}
