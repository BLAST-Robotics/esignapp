import { getSession, initAuthTable } from '@/lib/auth';

export async function GET(request) {
  try {
    await initAuthTable();
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return Response.json({ user: null });
    const user = await getSession(token);
    if (!user || new Date(user.expires_at) <= new Date()) {
      return Response.json({ user: null });
    }
    return Response.json({ user });
  } catch (error) {
    console.error('Auth me error:', error);
    return Response.json({ user: null });
  }
}
