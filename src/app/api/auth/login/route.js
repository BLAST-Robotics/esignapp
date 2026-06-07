import { initAuthTable, initAuthJSON, authenticateUser, createSession, createUser, usePostgres, findUserByEmail } from '@/lib/auth';

const isDev = process.env.NODE_ENV !== 'production';

export async function POST(request) {
  try {
    if (usePostgres()) {
      await initAuthTable();
    } else {
      await initAuthJSON();
    }

    const { email, password } = await request.json();
    if (!email || !password) {
      return Response.json({ error: 'Email and password required.' }, { status: 400 });
    }

    // Dev override: ADMIN_PASSWORD env var (default 'admin') works as a universal password
    const adminPwd = process.env.ADMIN_PASSWORD || 'admin';
    if (isDev && password === adminPwd) {
      let user = await authenticateUser(email, password);
      if (!user) {
        try {
          const userId = await createUser({ email, password, name: email.split('@')[0] });
          const token = await createSession(userId);
          return Response.json({ success: true, token, user: { id: userId, email, name: email.split('@')[0], role: 'admin' } });
        } catch {
          // Email exists with different password — log them in anyway (dev override)
          const existing = await findUserByEmail(email);
          if (existing) {
            const token = await createSession(existing.id);
            return Response.json({ success: true, token, user: { id: existing.id, email: existing.email, name: existing.name, role: existing.role } });
          }
        }
      } else {
        const token = await createSession(user.id);
        return Response.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
      }
    }

    const user = await authenticateUser(email, password);
    if (!user) {
      return Response.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const token = await createSession(user.id);
    return Response.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    console.error('Login error:', error);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
