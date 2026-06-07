import { requireAdmin } from '@/lib/auth';
import { getSettings, saveSettings } from '@/lib/settings';

export async function GET(request) {
  const user = await requireAdmin(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const settings = await getSettings();
    return Response.json({ settings });
  } catch (error) {
    console.error('Admin settings fetch error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const user = await requireAdmin(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    await saveSettings(body);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Settings save error:', error);
    return Response.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
