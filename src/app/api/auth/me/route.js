import { getSession } from '@/lib/auth';

export async function GET(request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return Response.json({ user: null });
    const user = await getSession(token);
    return Response.json({ user });
  } catch (error) {
    console.error('Auth me error:', error);
    return Response.json({ user: null });
  }
}
