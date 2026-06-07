import { deleteUserById, requireAdmin, updateUser } from '@/lib/auth';

const ALLOWED_UPDATES = new Set(['name', 'email', 'role', 'password']);

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const user = await requireAdmin(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const filtered = {};
    for (const k of ALLOWED_UPDATES) {
      if (k in body) filtered[k] = body[k];
    }
    if (Object.keys(filtered).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }
    await updateUser(id, filtered);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Admin update user error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const user = await requireAdmin(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    await deleteUserById(id);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Admin delete user error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
