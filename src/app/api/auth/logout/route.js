import { deleteSession } from '@/lib/auth';

export async function POST(request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (token) await deleteSession(token);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
