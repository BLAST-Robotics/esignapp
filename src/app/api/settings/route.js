import { getSettings } from '@/lib/settings';

export async function GET() {
  try {
    const settings = await getSettings();
    return Response.json({ settings });
  } catch (error) {
    console.error('Settings fetch error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
