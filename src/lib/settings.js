import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

const DEFAULTS = {
  pageWidth: 612,
  pageHeight: 792,
  signature: { x: 60, y: 638, width: 336, height: 44 },
  signedDate: { x: 431, y: 644, width: 144, height: 37, fontSize: 20 },
};

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(SETTINGS_FILE);
  } catch {
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(DEFAULTS, null, 2), 'utf-8');
  }
}

export async function getSettings() {
  await ensureFile();
  const raw = await fs.readFile(SETTINGS_FILE, 'utf-8');
  return { ...DEFAULTS, ...JSON.parse(raw) };
}

export async function saveSettings(settings) {
  await ensureFile();
  const merged = { ...DEFAULTS, ...settings };
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf-8');
}
