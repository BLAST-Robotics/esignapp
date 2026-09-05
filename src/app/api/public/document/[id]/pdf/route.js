import { getDocument, getDocumentFile } from '@/lib/storage';

export async function GET(_request, { params }) {
  const { id } = await params;
  try {
    const doc = await getDocument(id);
    if (!doc) return Response.json({ error: 'Not found' }, { status: 404 });
    const file = await getDocumentFile(id);
    if (!file) return Response.json({ error: 'File not found' }, { status: 404 });
    const buf = file.data;
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${doc.filename}"`,
        'Content-Length': String(buf?.length ?? buf?.byteLength ?? 0),
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    console.error('Public PDF fetch error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
