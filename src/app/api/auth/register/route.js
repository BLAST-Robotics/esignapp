import { initAuthTable, registerUser } from '@/lib/auth';

export async function POST(request) {
  try {
    await initAuthTable();
    const { email, password, name } = await request.json();
    if (!email || !password || password.length < 6) {
      return Response.json({ error: 'Email and password (min 6 chars) required.' }, { status: 400 });
    }
    const result = await registerUser(email, password, name);
    const res = Response.json({
      success: true,
      userId: result.userId,
      token: result.token,
      user: { id: result.userId, email: result.email, name: result.name, role: result.role },
    });
    res.headers.set(
      'Set-Cookie',
      `session=${result.token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 86400}`,
    );
    return res;
  } catch (error) {
    console.error('Register error:', error);
    if (error.message === 'Email already registered') {
      return Response.json({ error: 'Email already registered.' }, { status: 409 });
    }
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
