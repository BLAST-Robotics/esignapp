import { requireAuth } from '@/lib/auth';
import { getDocument, saveDocumentFields, updateDocument } from '@/lib/storage';

export async function PUT(request, { params }) {
  const user = await requireAuth(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const doc = await getDocument(id);
    if (!doc) return Response.json({ error: 'Not found' }, { status: 404 });
    const { fields } = await request.json();
    if (!Array.isArray(fields)) {
      return Response.json({ error: 'fields must be an array' }, { status: 400 });
    }
    await saveDocumentFields(id, fields);
    await updateDocument(id, { status: 'active' });
    return Response.json({ success: true });
  } catch (error) {
    console.error('Fields save error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
