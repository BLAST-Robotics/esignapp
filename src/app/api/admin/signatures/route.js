import { requireAuth } from '@/lib/auth';
import { getSignatures, initTable } from '@/lib/storage';

export async function GET(request) {
  const user = await requireAuth(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await initTable();
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const signatures = await getSignatures(documentId || null);
    return Response.json({ signatures });
  } catch (error) {
    console.error('Admin fetch error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const user = await requireAuth(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await initTable();
    const { documentId, fieldValues } = await request.json();
    if (!documentId || !fieldValues) {
      return Response.json({ error: 'documentId and fieldValues required' }, { status: 400 });
    }
    const { insertSignature } = await import('@/lib/storage');
    const id = await insertSignature({ documentId, fieldValues, ipAddress: 'admin' });
    return Response.json({ success: true, id });
  } catch (error) {
    console.error('Admin create error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
