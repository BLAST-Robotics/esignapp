import {
  authenticateUser,
  createUser,
  createUserSession,
  findUserByEmail,
  hashPassword,
  initAuthJSON,
  initAuthTable,
  normEmail,
  seedAdminUser,
} from '@/lib/auth';

const isDev = process.env.NODE_ENV !== 'production';

const loginAttempts = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const window = 60_000;
  const max = 10;
  const entry = loginAttempts.get(ip) || { count: 0, resetAt: now + window };
  if (entry.resetAt < now) {
    entry.count = 0;
    entry.resetAt = now + window;
  }
  entry.count++;
  loginAttempts.set(ip, entry);
  if (entry.count > max) {
    loginAttempts.delete(ip);
  }
  return entry.count <= max;
}

export async function POST(request) {
  try {
    await initAuthTable();
    await initAuthJSON();
    await seedAdminUser();

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    if (!rateLimit(ip)) {
      return Response.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
    }

    const { email, password } = await request.json();
    if (!email || !password) {
      return Response.json({ error: 'Email and password required.' }, { status: 400 });
    }

    const normalized = normEmail(email);

    // Dev override: ADMIN_PASSWORD env var works as a universal password
    const adminPwd = process.env.ADMIN_PASSWORD || 'admin';
    if (isDev && password === adminPwd) {
      const result = await authenticateUser(normalized, password);
      if (result) {
        const res = Response.json({
          success: true,
          token: result.token,
          user: { id: result.userId, email: result.email, name: result.name, role: result.role },
        });
        res.headers.set(
          'Set-Cookie',
          `session=${result.token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 86400}`,
        );
        return res;
      }
      try {
        const userId = await createUser({
          email: normalized,
          password: hashPassword(password),
          name: normalized.split('@')[0],
          role: 'admin',
        });
        const token = await createUserSession(userId);
        const res = Response.json({
          success: true,
          token,
          user: { id: userId, email: normalized, name: normalized.split('@')[0], role: 'admin' },
        });
        res.headers.set(
          'Set-Cookie',
          `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 86400}`,
        );
        return res;
      } catch {
        const existing = await findUserByEmail(normalized);
        if (existing) {
          const token = await createUserSession(existing.id);
          const res = Response.json({
            success: true,
            token,
            user: { id: existing.id, email: existing.email, name: existing.name, role: existing.role },
          });
          res.headers.set(
            'Set-Cookie',
            `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 86400}`,
          );
          return res;
        }
      }
    }

    const result = await authenticateUser(normalized, password);
    if (!result) {
      return Response.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const res = Response.json({
      success: true,
      token: result.token,
      user: { id: result.userId, email: result.email, name: result.name, role: result.role },
    });
    res.headers.set(
      'Set-Cookie',
      `session=${result.token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 86400}`,
    );
    return res;
  } catch (error) {
    console.error('Login error:', error);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
