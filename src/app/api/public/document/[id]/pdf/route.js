import { getDocument, getDocumentFile } from '@/lib/storage';

export async function GET(_request, { params }) {
  const { id } = await params;
  try {
    const doc = await getDocument(id);
    if (!doc) return Response.json({ error: 'Not found' }, { status: 404 });
    const file = await getDocumentFile(id);
    if (!file) return Response.json({ error: 'File not found' }, { status: 404 });
    return new Response(file.data, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${doc.filename}"`,
      },
    });
  } catch (error) {
    console.error('Public PDF fetch error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
