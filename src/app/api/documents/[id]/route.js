import { getDocument, updateDocument, deleteDocument } from '@/lib/storage';
import { requireAuth } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

async function checkPerm(request, documentId, minLevel) {
  const user = await requireAuth(request);
  if (!user) return null;
  if (user.role === 'admin') return user;
  const doc = await getDocument(documentId);
  if (!doc) return null;
  if (doc.user_id === user.userId) return user;
  const { getUserPermission } = await import('@/lib/auth');
  const perm = await getUserPermission(documentId, user.userId);
  if (!perm) return null;
  const levels = { view: 0, edit: 1, manage: 2 };
  if ((levels[perm] || 0) >= (levels[minLevel] || 0)) return user;
  return null;
}

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const user = await checkPerm(request, id, 'view');
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const doc = await getDocument(id);
    if (!doc) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ document: doc });
  } catch (error) {
    console.error('Document get error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const user = await checkPerm(request, id, 'edit');
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const ct = request.headers.get('content-type') || '';
    if (ct.includes('multipart/form-data')) {
      const perm = user.role === 'admin' ? 'manage' : (await import('@/lib/auth')).getUserPermission ? (await (await import('@/lib/auth')).getUserPermission(id, user.userId)) || 'manage' : 'manage';
      if (perm !== 'manage' && user.role !== 'admin') {
        return Response.json({ error: 'Manage permission required to replace PDF' }, { status: 403 });
      }
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file || !file.name?.toLowerCase().endsWith('.pdf')) {
        return Response.json({ error: 'Please upload a PDF file' }, { status: 400 });
      }
      const uploadsDir = path.join(process.cwd(), '.data', 'uploads');
      await fs.mkdir(uploadsDir, { recursive: true });
      const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const filePath = path.join(uploadsDir, filename);
      const bytes = await file.arrayBuffer();
      await fs.writeFile(filePath, Buffer.from(bytes));
      const doc = await getDocument(id);
      if (doc?.file_path) { try { await fs.unlink(doc.file_path); } catch {} }
      await updateDocument(id, { file_path: filePath, filename });
      return Response.json({ success: true });
    } else {
      const body = await request.json();
      await updateDocument(id, body);
      return Response.json({ success: true });
    }
  } catch (error) {
    console.error('Document update error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const user = await checkPerm(request, id, 'manage');
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const doc = await getDocument(id);
    if (!doc) return Response.json({ error: 'Not found' }, { status: 404 });
    if (doc.file_path) {
      try { await fs.unlink(doc.file_path); } catch {}
    }
    await deleteDocument(id);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Document delete error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
