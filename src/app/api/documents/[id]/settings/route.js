import { requireAuth } from '@/lib/auth';
import { getDocument, getDocumentSettings, updateDocumentSettings } from '@/lib/storage';

function canManage(document, user) {
  if (!document || !user) return false;
  if (user.role === 'admin') return true;
  if (document.user_id === user.userId) return true;
  return false;
}

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const user = await requireAuth(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const doc = await getDocument(id);
    if (!doc) return Response.json({ error: 'Not found' }, { status: 404 });
    if (!canManage(doc, user)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const settings = await getDocumentSettings(id);
    return Response.json({ settings });
  } catch (error) {
    console.error('Document settings get error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const user = await requireAuth(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const doc = await getDocument(id);
    if (!doc) return Response.json({ error: 'Not found' }, { status: 404 });
    if (!canManage(doc, user)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await request.json();
    await updateDocumentSettings(id, body);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Document settings save error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
