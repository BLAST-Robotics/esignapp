import { initAuthTable, createUser } from '@/lib/auth';

export async function POST(request) {
  try {
    await initAuthTable();
    const { email, password, name } = await request.json();
    if (!email || !password || password.length < 6) {
      return Response.json({ error: 'Email and password (min 6 chars) required.' }, { status: 400 });
    }
    const userId = await createUser({ email, password, name });
    return Response.json({ success: true, userId });
  } catch (error) {
    console.error('Register error:', error);
    if (error.message === 'Email already exists') {
      return Response.json({ error: 'Email already registered.' }, { status: 409 });
    }
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
