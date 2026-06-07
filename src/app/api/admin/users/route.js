import { getAllUsers, requireAdmin } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = await requireAdmin(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const users = await getAllUsers();
    return Response.json({ users });
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
    const { createUser } = await import('@/lib/auth');
    const userId = await createUser({ email, password, name: name || email.split('@')[0] });
    if (role === 'admin') {
      const { updateUser } = await import('@/lib/auth');
      await updateUser(userId, { role: 'admin' });
    }
    return Response.json({ success: true, userId });
  } catch (error) {
    console.error('Admin create user error:', error);
    if (error.message === 'Email already exists')
      return Response.json({ error: 'Email already exists' }, { status: 409 });
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
