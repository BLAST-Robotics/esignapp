import crypto from 'node:crypto';
import {
  cleanExpiredSessions,
  createSession,
  createUser,
  deleteSession,
  deleteUser,
  findUserByEmail,
  getAccessibleDocuments,
  getPermissions,
  getSession,
  getUser,
  getUserPermission,
  getUsers,
  grantPermission,
  initAuthJSON,
  initAuthTable,
  removePermission,
  updateUser,
} from './drivers/auth.js';
import { isPostgres, isSqlite } from './drivers/engine.js';

const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Password hashing ───────────────────────────────

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

// ─── Seed admin ──────────────────────────────────────

const SEED_EMAIL = 'hello@keystonestemai.org';
const SEED_PASSWORD = 'Keystone#2026$';

export async function seedAdminUser() {
  const existing = await findUserByEmail(SEED_EMAIL);
  if (existing) return;
  await createUser({
    email: SEED_EMAIL,
    password: hashPassword(SEED_PASSWORD),
    name: 'Admin',
    role: 'admin',
  });
  console.log('Seeded admin user:', SEED_EMAIL);
}

// ─── Session wrapper (backward compat) ──────────────

export async function createUserSession(userId) {
  const token = genToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL).toISOString();
  await createSession({ userId, token, expiresAt });
  return token;
}

// ─── Auth helpers ────────────────────────────────────

export async function registerUser(email, password, name) {
  const existing = await findUserByEmail(email);
  if (existing) throw new Error('Email already registered');
  const hashed = hashPassword(password);
  const userId = await createUser({ email, password: hashed, name, role: 'user' });
  const token = genToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL).toISOString();
  await createSession({ userId, token, expiresAt });
  return { token, userId, email, name, role: 'user' };
}

export async function authenticateUser(email, password) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  if (!verifyPassword(password, user.password)) return null;
  const token = genToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL).toISOString();
  await createSession({ userId: user.id, token, expiresAt });
  return { token, userId: user.id, email: user.email, name: user.name, role: user.role };
}

export async function requireAuth(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace('Bearer ', '');

  if (token) {
    const session = await getSession(token);
    if (session && new Date(session.expires_at) > new Date()) {
      return { userId: session.userId, email: session.email, name: session.name, role: session.role };
    }
  }

  // Dev override: ADMIN_PASSWORD
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminPassword) {
    const upw = request.headers.get('x-admin-password');
    if (upw === adminPassword) {
      const email = request.headers.get('x-admin-email') || 'dev@local';
      const user = await findUserByEmail(email);
      if (!user) {
        const hashed = hashPassword(adminPassword);
        const userId = await createUser({ email, password: hashed, name: 'Dev User', role: 'admin' });
        return { userId, email, name: 'Dev User', role: 'admin' };
      }
      return { userId: user.id, email: user.email, name: user.name, role: 'admin' };
    }
  }

  return null;
}

export async function requireAdmin(request) {
  const user = await requireAuth(request);
  if (user?.role !== 'admin') return null;
  return user;
}

// ─── Re-export data functions ────────────────────────

export {
  cleanExpiredSessions,
  createUser,
  deleteSession,
  deleteUser,
  findUserByEmail,
  genToken,
  getAccessibleDocuments,
  getPermissions,
  getSession,
  getUser,
  getUserPermission,
  getUsers,
  grantPermission,
  hashPassword,
  initAuthJSON,
  initAuthTable,
  isPostgres,
  isSqlite,
  removePermission,
  updateUser,
};

// Legacy aliases
export const getAllUsers = getUsers;
export const deleteUserById = deleteUser;
export const initPermTable = initAuthTable;
export const setPermission = grantPermission;
