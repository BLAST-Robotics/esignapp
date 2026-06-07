import {
  authenticateUser,
  createUser,
  createUserSession,
  findUserByEmail,
  hashPassword,
  initAuthJSON,
  initAuthTable,
  seedAdminUser,
} from '@/lib/auth';

const isDev = process.env.NODE_ENV !== 'production';

export async function POST(request) {
  try {
    await initAuthTable();
    await initAuthJSON();
    await seedAdminUser();

    const { email, password } = await request.json();
    if (!email || !password) {
      return Response.json({ error: 'Email and password required.' }, { status: 400 });
    }

    // Dev override: ADMIN_PASSWORD env var (default 'admin') works as a universal password
    const adminPwd = process.env.ADMIN_PASSWORD || 'admin';
    if (isDev && password === adminPwd) {
      const result = await authenticateUser(email, password);
      if (result) {
        return Response.json({
          success: true,
          token: result.token,
          user: { id: result.userId, email: result.email, name: result.name, role: result.role },
        });
      }
      // Dev override: create user if not exists
      try {
        const userId = await createUser({
          email,
          password: hashPassword(password),
          name: email.split('@')[0],
          role: 'admin',
        });
        const token = await createUserSession(userId);
        return Response.json({
          success: true,
          token,
          user: { id: userId, email, name: email.split('@')[0], role: 'admin' },
        });
      } catch {
        // Email exists with different password — dev override login anyway
        const existing = await findUserByEmail(email);
        if (existing) {
          const token = await createUserSession(existing.id);
          return Response.json({
            success: true,
            token,
            user: { id: existing.id, email: existing.email, name: existing.name, role: existing.role },
          });
        }
      }
    }

    const result = await authenticateUser(email, password);
    if (!result) {
      return Response.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    return Response.json({
      success: true,
      token: result.token,
      user: { id: result.userId, email: result.email, name: result.name, role: result.role },
    });
  } catch (error) {
    console.error('Login error:', error);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
