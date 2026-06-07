import { getDocument } from '@/lib/storage';
import { requireAuth, initPermTable, setPermission, removePermission, getPermissions } from '@/lib/auth';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const user = await requireAuth(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const doc = await getDocument(id);
    if (!doc) return Response.json({ error: 'Not found' }, { status: 404 });
    if (doc.user_id !== user.userId && user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
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
    if (doc.user_id !== user.userId && user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const { email, permission } = await request.json();
    if (!email || !permission) return Response.json({ error: 'Email and permission required' }, { status: 400 });
    if (!['view', 'edit', 'manage'].includes(permission)) return Response.json({ error: 'Invalid permission' }, { status: 400 });

    // Find user by email
    const { initAuthTable } = await import('@/lib/auth');
    await initAuthTable();
    const { getSession } = await import('@/lib/auth');
    // We need a function to find user by email. Let's use authenticateUser or create a specific lookup
    // For now, use the login/auth mechanism. Actually let me import and use a lookup function.
    const { default: crypto } = await import('crypto');
    const fs = await import('fs/promises');
    const path = await import('path');

    // Quick user lookup
    let targetUser = null;
    if (process.env.POSTGRES_URL && process.env.POSTGRES_URL !== 'postgres://placeholder:placeholder@localhost:5432/placeholder') {
      const { createPool } = await import('@vercel/postgres');
      const pool = createPool({ connectionString: process.env.POSTGRES_URL });
      const client = await pool.connect();
      try {
        const { rows } = await client.sql`SELECT id, email, name FROM users WHERE email = ${email}`;
        if (rows.length > 0) targetUser = rows[0];
      } finally { client.release(); }
    } else {
      const dataDir = path.join(process.cwd(), '.data');
      const usersFile = path.join(dataDir, 'users.json');
      try {
        const raw = await fs.readFile(usersFile, 'utf-8');
        const users = JSON.parse(raw);
        targetUser = users.find((u) => u.email === email);
      } catch {}
    }

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
    if (doc.user_id !== user.userId && user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    if (!email) return Response.json({ error: 'Email required' }, { status: 400 });
    // Lookup user by email
    let targetUser = null;
    if (process.env.POSTGRES_URL && process.env.POSTGRES_URL !== 'postgres://placeholder:placeholder@localhost:5432/placeholder') {
      const { createPool } = await import('@vercel/postgres');
      const pool = createPool({ connectionString: process.env.POSTGRES_URL });
      const client = await pool.connect();
      try {
        const { rows } = await client.sql`SELECT id FROM users WHERE email = ${email}`;
        if (rows.length > 0) targetUser = rows[0];
      } finally { client.release(); }
    } else {
      const dataDir = path.join(process.cwd(), '.data');
      const usersFile = path.join(dataDir, 'users.json');
      try {
        const raw = await fs.readFile(usersFile, 'utf-8');
        const users = JSON.parse(raw);
        targetUser = users.find((u) => u.email === email);
      } catch {}
    }
    if (!targetUser) return Response.json({ error: 'User not found' }, { status: 404 });
    await removePermission({ documentId: id, userId: targetUser.id });
    return Response.json({ success: true });
  } catch (error) {
    console.error('Permission remove error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
