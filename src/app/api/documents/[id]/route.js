import { requireAuth } from '@/lib/auth';
import { deleteDocument, getDocument, updateDocument } from '@/lib/storage';

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
      const perm =
        user.role === 'admin'
          ? 'manage'
          : (await import('@/lib/auth')).getUserPermission
            ? (await (await import('@/lib/auth')).getUserPermission(id, user.userId)) || 'manage'
            : 'manage';
      if (perm !== 'manage' && user.role !== 'admin') {
        return Response.json({ error: 'Manage permission required to replace PDF' }, { status: 403 });
      }
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file?.name?.toLowerCase().endsWith('.pdf')) {
        return Response.json({ error: 'Please upload a PDF file' }, { status: 400 });
      }
      const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const bytes = await file.arrayBuffer();
      const fileBuffer = Buffer.from(bytes);
      await updateDocument(id, { file_data: fileBuffer, filename, file_path: filename });
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
    await deleteDocument(id);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Document delete error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
