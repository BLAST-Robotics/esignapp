import { requireAuth } from '@/lib/auth';
import { getSignatures } from '@/lib/storage';

export async function GET(request, { params }) {
  const user = await requireAuth(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const signatures = await getSignatures(id);
    return Response.json({ signatures });
  } catch (error) {
    console.error('Document signatures error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
