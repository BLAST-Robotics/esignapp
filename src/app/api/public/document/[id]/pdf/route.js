import fs from 'fs/promises';
import { getDocument } from '@/lib/storage';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const doc = await getDocument(id);
    if (!doc || !doc.file_path) return Response.json({ error: 'Not found' }, { status: 404 });
    const bytes = await fs.readFile(doc.file_path);
    return new Response(bytes, {
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
