import { requireAdmin, updateUser, deleteUserById } from '@/lib/auth';

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const user = await requireAdmin(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    await updateUser(id, body);
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
