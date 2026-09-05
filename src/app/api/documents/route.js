import { getAccessibleDocuments, requireAuth } from '@/lib/auth';
import { compressPdfBuffer } from '@/lib/compressPdf';
import { createDocument, getDocuments, initTable } from '@/lib/storage';

const DOC_LIST_FIELDS = [
  'id',
  'user_id',
  'title',
  'filename',
  'slug',
  'status',
  'fields',
  'created_at',
  'updated_at',
  'collect_email',
  'settings',
  'permission',
];

function stripDoc(doc) {
  const safe = {};
  for (const k of DOC_LIST_FIELDS) {
    if (k in doc) safe[k] = doc[k];
  }
  return safe;
}

export async function GET(request) {
  try {
    await initTable();
    const user = await requireAuth(request);
    let docs;

    if (user && user.role === 'admin') {
      docs = await getDocuments();
    } else if (user) {
      docs = await getDocuments({ userId: user.userId });
      const shared = await getAccessibleDocuments(user.userId);
      for (const s of shared) {
        if (!docs.find((d) => d.id === s.document_id)) {
          const { getDocument } = await import('@/lib/storage');
          const d = await getDocument(s.document_id);
          if (d) {
            d.permission = s.permission;
            docs.push(d);
          }
        } else {
          const existing = docs.find((d) => d.id === s.document_id);
          if (existing) existing.permission = s.permission;
        }
      }
    } else {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return Response.json({ documents: (docs || []).map(stripDoc) });
  } catch (error) {
    console.error('Documents fetch error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await initTable();
    const user = await requireAuth(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file');
    const title = formData.get('title') || file?.name?.replace(/\.pdf$/i, '') || 'Untitled';

    if (!file?.name?.toLowerCase().endsWith('.pdf')) {
      return Response.json({ error: 'Please upload a PDF file' }, { status: 400 });
    }

    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const bytes = await file.arrayBuffer();
    let fileBuffer = Buffer.from(bytes);
    // compress on upload — reduces LCP/storage; no-op if not compressible
    fileBuffer = await compressPdfBuffer(fileBuffer);

    const id = await createDocument({ title, filename, fileBuffer, userId: user.userId });

    return Response.json({ success: true, id });
  } catch (error) {
    console.error('Document upload error:', error);
    return Response.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}
