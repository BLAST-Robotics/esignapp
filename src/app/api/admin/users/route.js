import { createUser, getAllUsers, hashPassword, requireAdmin } from '@/lib/auth';

const SAFE_USER_FIELDS = ['id', 'email', 'name', 'role', 'created_at'];

function stripUser(user) {
  if (!user) return user;
  const safe = {};
  for (const k of SAFE_USER_FIELDS) {
    if (k in user) safe[k] = user[k];
  }
  return safe;
}

export async function GET(request) {
  try {
    const user = await requireAdmin(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const users = await getAllUsers();
    return Response.json({ users: users.map(stripUser) });
  } catch (error) {
    console.error('Admin users fetch error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { email, password, name, role } = await request.json();
    if (!email || !password) return Response.json({ error: 'Email and password required' }, { status: 400 });
    const normalizedEmail = email.trim().toLowerCase();
    const userId = await createUser({
      email: normalizedEmail,
      password: hashPassword(password),
      name: (name || normalizedEmail.split('@')[0]).trim(),
      role: role === 'admin' ? 'admin' : 'user',
    });
    return Response.json({ success: true, userId });
  } catch (error) {
    console.error('Admin create user error:', error);
    if (error.message === 'Email already registered')
      return Response.json({ error: 'Email already exists' }, { status: 409 });
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
