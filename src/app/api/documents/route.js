import { initTable, createDocument, getDocuments } from '@/lib/storage';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { getAccessibleDocuments, getUserPermission } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request) {
  try {
    await initTable();
    let user = await requireAuth(request);
    let docs;

    if (user && user.role === 'admin') {
      docs = await getDocuments();
    } else if (user) {
      docs = await getDocuments({ userId: user.userId });
      // Also include shared documents
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

    return Response.json({ documents: docs || [] });
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

    if (!file || !file.name?.toLowerCase().endsWith('.pdf')) {
      return Response.json({ error: 'Please upload a PDF file' }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), '.data', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(uploadsDir, filename);

    const bytes = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(bytes));

    const id = await createDocument({ title, filename, filePath, userId: user.userId });

    return Response.json({ success: true, id });
  } catch (error) {
    console.error('Document upload error:', error);
    return Response.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}
