import { getDocument } from '@/lib/storage';

export async function GET(_request, { params }) {
  const { id } = await params;
  try {
    const doc = await getDocument(id);
    if (!doc) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ document: { id: doc.id, title: doc.title, fields: doc.fields || [] } });
  } catch (error) {
    console.error('Public document fetch error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
