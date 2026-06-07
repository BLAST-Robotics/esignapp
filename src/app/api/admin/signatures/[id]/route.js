import { getSignature, updateSignature, deleteSignature } from '@/lib/storage';
import { requireAuth } from '@/lib/auth';

export async function GET(request, { params }) {
  const user = await requireAuth(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const sig = await getSignature(id);
    if (!sig) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ signature: sig });
  } catch (error) {
    console.error('Fetch signature error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const user = await requireAuth(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const body = await request.json();
    await updateSignature(id, body);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Update signature error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const user = await requireAuth(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    await deleteSignature(id);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Delete signature error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
