import {
  findUserByEmail,
  getPermissions,
  initPermTable,
  removePermission,
  requireAuth,
  setPermission,
} from '@/lib/auth';
import { getDocument } from '@/lib/storage';
import { validatePermissionRequest } from '@/lib/validation';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const user = await requireAuth(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const doc = await getDocument(id);
    if (!doc) return Response.json({ error: 'Not found' }, { status: 404 });
    if (doc.user_id !== user.userId && user.role !== 'admin')
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    const perms = await getPermissions(id);
    return Response.json({ permissions: perms });
  } catch (error) {
    console.error('Permissions fetch error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const { id } = await params;
  try {
    await initPermTable();
    const user = await requireAuth(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const doc = await getDocument(id);
    if (!doc) return Response.json({ error: 'Not found' }, { status: 404 });
    if (doc.user_id !== user.userId && user.role !== 'admin')
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await request.json();
    const permErr = validatePermissionRequest(body);
    if (permErr) return Response.json({ error: permErr }, { status: 400 });
    const { email, permission } = body;

    const targetUser = await findUserByEmail(email);
    if (!targetUser) return Response.json({ error: 'User not found' }, { status: 404 });
    await setPermission({ documentId: id, userId: targetUser.id, permission });
    return Response.json({ success: true });
  } catch (error) {
    console.error('Permission set error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const user = await requireAuth(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const doc = await getDocument(id);
    if (!doc) return Response.json({ error: 'Not found' }, { status: 404 });
    if (doc.user_id !== user.userId && user.role !== 'admin')
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    if (!email) return Response.json({ error: 'Email required' }, { status: 400 });
    const targetUser = await findUserByEmail(email);
    if (!targetUser) return Response.json({ error: 'User not found' }, { status: 404 });
    await removePermission({ documentId: id, userId: targetUser.id });
    return Response.json({ success: true });
  } catch (error) {
    console.error('Permission remove error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
