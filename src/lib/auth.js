import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${key}`;
}

function verifyPassword(password, stored) {
  const [salt, key] = stored.split(':');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return key === derived;
}

function genToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function ensureFile(file, initial) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { await fs.access(file); }
  catch { await fs.writeFile(file, JSON.stringify(initial, null, 2), 'utf-8'); }
}

async function readJSON(file) {
  await ensureFile(file, []);
  const raw = await fs.readFile(file, 'utf-8');
  return JSON.parse(raw);
}

async function writeJSON(file, data) {
  await ensureFile(file, []);
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
}

let poolPromise = null;
async function getPool() {
  if (!poolPromise) {
    const { createPool } = await import('@vercel/postgres');
    poolPromise = createPool({ connectionString: process.env.POSTGRES_URL });
  }
  return poolPromise;
}

async function withClient(fn) {
  const pool = await getPool();
  const client = await pool.connect();
  try { return await fn(client); }
  finally { client.release(); }
}

export function usePostgres() {
  return !!process.env.POSTGRES_URL && process.env.POSTGRES_URL !== 'postgres://placeholder:placeholder@localhost:5432/placeholder';
}

export async function initAuthTable() {
  if (!usePostgres()) return;
  await withClient(async (client) => {
    await client.sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL DEFAULT '',
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await client.sql`
      CREATE TABLE IF NOT EXISTS sessions (
        token VARCHAR(64) PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        expires TIMESTAMPTZ NOT NULL
      )
    `;
  });
  await seedAdminUser();
}

export async function initAuthJSON() {
  if (usePostgres()) return;
  await ensureFile(USERS_FILE, []);
  await ensureFile(SESSIONS_FILE, []);
  await seedAdminUser();
}

export async function seedAdminUser() {
  const adminEmail = 'hello@keystonestemai.org';
  const adminPassword = 'Keystone#2026$';

  if (usePostgres()) {
    return await withClient(async (client) => {
      const { rows } = await client.sql`SELECT id FROM users WHERE email = ${adminEmail}`;
      if (rows.length > 0) return;
      const hash = hashPassword(adminPassword);
      await client.sql`
        INSERT INTO users (email, password_hash, name, role)
        VALUES (${adminEmail}, ${hash}, 'Admin', 'admin')
      `;
      console.log('Admin user seeded (hello@keystonestemai.org)');
    });
  }

  const users = await readJSON(USERS_FILE);
  if (users.find((u) => u.email === adminEmail)) return;
  users.push({
    id: genToken().slice(0, 36),
    email: adminEmail,
    password_hash: hashPassword(adminPassword),
    name: 'Admin',
    role: 'admin',
    created_at: new Date().toISOString(),
  });
  await writeJSON(USERS_FILE, users);
  console.log('Admin user seeded (hello@keystonestemai.org)');
}

export async function createUser({ email, password, name }) {
  const passwordHash = hashPassword(password);
  if (usePostgres()) {
    return await withClient(async (client) => {
      const { rows } = await client.sql`
        INSERT INTO users (email, password_hash, name, role) VALUES (${email}, ${passwordHash}, ${name || ''}, 'user')
        ON CONFLICT (email) DO NOTHING RETURNING id
      `;
      if (rows.length === 0) throw new Error('Email already exists');
      return rows[0].id;
    });
  }
  const users = await readJSON(USERS_FILE);
  if (users.find((u) => u.email === email)) throw new Error('Email already exists');
  const id = crypto.randomUUID ? crypto.randomUUID() : genToken().slice(0, 36);
  users.push({ id, email, password_hash: passwordHash, name: name || '', role: 'user', created_at: new Date().toISOString() });
  await writeJSON(USERS_FILE, users);
  return id;
}

export async function findUserByEmail(email) {
  if (usePostgres()) {
    return await withClient(async (client) => {
      const { rows } = await client.sql`SELECT id, email, name, role FROM users WHERE email = ${email}`;
      return rows[0] || null;
    });
  }
  const users = await readJSON(USERS_FILE);
  return users.find((u) => u.email === email) || null;
}

export async function authenticateUser(email, password) {
  if (usePostgres()) {
    return await withClient(async (client) => {
      const { rows } = await client.sql`SELECT * FROM users WHERE email = ${email}`;
      if (rows.length === 0) return null;
      if (!verifyPassword(password, rows[0].password_hash)) return null;
      return { id: rows[0].id, email: rows[0].email, name: rows[0].name, role: rows[0].role };
    });
  }
  const users = await readJSON(USERS_FILE);
  const user = users.find((u) => u.email === email);
  if (!user) return null;
  if (!verifyPassword(password, user.password_hash)) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function createSession(userId) {
  const token = genToken();
  const expires = new Date(Date.now() + SESSION_TTL).toISOString();
  if (usePostgres()) {
    await withClient(async (client) => {
      await client.sql`INSERT INTO sessions (token, user_id, expires) VALUES (${token}, ${userId}, ${expires})`;
    });
    return token;
  }
  const sessions = await readJSON(SESSIONS_FILE);
  sessions.push({ token, user_id: userId, expires });
  await writeJSON(SESSIONS_FILE, sessions);
  return token;
}

export async function getSession(token) {
  if (!token) return null;
  if (usePostgres()) {
    return await withClient(async (client) => {
      const { rows } = await client.sql`
        SELECT s.token, s.user_id, s.expires, u.email, u.name, u.role
        FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token = ${token} AND s.expires > NOW()
      `;
      if (rows.length === 0) return null;
      return { userId: rows[0].user_id, email: rows[0].email, name: rows[0].name, role: rows[0].role };
    });
  }
  const sessions = await readJSON(SESSIONS_FILE);
  const s = sessions.find((s) => s.token === token && new Date(s.expires) > new Date());
  if (!s) return null;
  const users = await readJSON(USERS_FILE);
  const u = users.find((u) => u.id === s.user_id);
  if (!u) return null;
  return { userId: u.id, email: u.email, name: u.name, role: u.role };
}

export async function deleteSession(token) {
  if (usePostgres()) {
    await withClient(async (client) => {
      await client.sql`DELETE FROM sessions WHERE token = ${token}`;
    });
    return;
  }
  const sessions = await readJSON(SESSIONS_FILE);
  await writeJSON(SESSIONS_FILE, sessions.filter((s) => s.token !== token));
}

export async function getAllUsers() {
  if (usePostgres()) {
    return await withClient(async (client) => {
      const { rows } = await client.sql`SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC`;
      return rows;
    });
  }
  const users = await readJSON(USERS_FILE);
  return users.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, created_at: u.created_at }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function updateUser(id, updates) {
  if (usePostgres()) {
    return await withClient(async (client) => {
      if (updates.password) {
        updates.password_hash = hashPassword(updates.password);
        delete updates.password;
      }
      const sets = Object.entries(updates)
        .filter(([k]) => k !== 'id')
        .map(([k, v]) => `${k.replace(/([A-Z])/g, '_$1').toLowerCase()} = ${typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v}`)
        .join(', ');
      if (!sets) return;
      await client.sql`UPDATE users SET ${sets} WHERE id = ${id}`;
    });
  }
  const users = await readJSON(USERS_FILE);
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error('User not found');
  if (updates.password) {
    updates.password_hash = hashPassword(updates.password);
    delete updates.password;
  }
  Object.assign(users[idx], updates);
  await writeJSON(USERS_FILE, users);
}

export async function deleteUserById(id) {
  if (usePostgres()) {
    return await withClient(async (client) => {
      await client.sql`DELETE FROM users WHERE id = ${id}`;
    });
  }
  const users = await readJSON(USERS_FILE);
  await writeJSON(USERS_FILE, users.filter((u) => u.id !== id));
}

export async function getUserFromRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  // Try session token first
  const session = await getSession(token);
  if (session) return session;
  // Legacy password fallback
  if (token === (process.env.ADMIN_PASSWORD || 'admin')) {
    return { userId: 'admin', email: 'admin@keysign.app', name: 'Admin', role: 'admin' };
  }
  return null;
}

export async function requireAdmin(request) {
  const user = await getUserFromRequest(request);
  if (!user) return null;
  if (user.role !== 'admin') return null;
  return user;
}

export async function requireAuth(request) {
  return await getUserFromRequest(request);
}

export async function cleanupSessions() {
  if (usePostgres()) {
    await withClient(async (client) => {
      await client.sql`DELETE FROM sessions WHERE expires <= NOW()`;
    });
    return;
  }
  const sessions = await readJSON(SESSIONS_FILE);
  await writeJSON(SESSIONS_FILE, sessions.filter((s) => new Date(s.expires) > new Date()));
}

// ─── Permissions ─────────────────────────────────────────────────

const PERM_FILE = path.join(DATA_DIR, 'permissions.json');

export async function initPermTable() {
  if (!usePostgres()) return;
  await withClient(async (client) => {
    await client.sql`
      CREATE TABLE IF NOT EXISTS document_permissions (
        id SERIAL PRIMARY KEY,
        document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        permission VARCHAR(20) NOT NULL DEFAULT 'view',
        UNIQUE(document_id, user_id)
      )
    `;
  });
}

export async function setPermission({ documentId, userId, permission }) {
  if (usePostgres()) {
    await withClient(async (client) => {
      await client.sql`
        INSERT INTO document_permissions (document_id, user_id, permission)
        VALUES (${documentId}, ${userId}, ${permission})
        ON CONFLICT (document_id, user_id) DO UPDATE SET permission = ${permission}
      `;
    });
    return;
  }
  const perms = await readJSON(PERM_FILE);
  const idx = perms.findIndex((p) => p.document_id === documentId && p.user_id === userId);
  if (idx >= 0) {
    perms[idx].permission = permission;
  } else {
    perms.push({ document_id: documentId, user_id: userId, permission });
  }
  await writeJSON(PERM_FILE, perms);
}

export async function removePermission({ documentId, userId }) {
  if (usePostgres()) {
    await withClient(async (client) => {
      await client.sql`DELETE FROM document_permissions WHERE document_id = ${documentId} AND user_id = ${userId}`;
    });
    return;
  }
  const perms = await readJSON(PERM_FILE);
  await writeJSON(PERM_FILE, perms.filter((p) => !(p.document_id === documentId && p.user_id === userId)));
}

export async function getPermissions(documentId) {
  if (usePostgres()) {
    return await withClient(async (client) => {
      const { rows } = await client.sql`
        SELECT dp.*, u.email, u.name FROM document_permissions dp
        JOIN users u ON u.id = dp.user_id
        WHERE dp.document_id = ${documentId}
      `;
      return rows;
    });
  }
  const perms = await readJSON(PERM_FILE);
  const users = await readJSON(USERS_FILE);
  return perms
    .filter((p) => p.document_id === documentId)
    .map((p) => {
      const u = users.find((u) => u.id === p.user_id);
      return { ...p, email: u?.email || 'unknown', name: u?.name || '' };
    });
}

export async function getUserPermission(documentId, userId) {
  if (!documentId || !userId) return null;
  if (usePostgres()) {
    return await withClient(async (client) => {
      const { rows } = await client.sql`
        SELECT permission FROM document_permissions WHERE document_id = ${documentId} AND user_id = ${userId}
      `;
      return rows[0]?.permission || null;
    });
  }
  const perms = await readJSON(PERM_FILE);
  const p = perms.find((p) => p.document_id === documentId && p.user_id === userId);
  return p?.permission || null;
}

export async function getAccessibleDocuments(userId) {
  if (!userId) return [];
  if (usePostgres()) {
    return await withClient(async (client) => {
      const { rows } = await client.sql`
        SELECT document_id, permission FROM document_permissions WHERE user_id = ${userId}
      `;
      return rows;
    });
  }
  const perms = await readJSON(PERM_FILE);
  return perms.filter((p) => p.user_id === userId).map((p) => ({ document_id: p.document_id, permission: p.permission }));
}
