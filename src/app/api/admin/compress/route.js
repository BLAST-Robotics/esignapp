import { requireAdmin } from '@/lib/auth';
import { compressPdfBuffer } from '@/lib/compressPdf';

export async function POST(request) {
  const user = await requireAdmin(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { getEngine } = await import('@/lib/drivers/engine.js');
  const engine = getEngine();
  const mod = await import(`@/lib/drivers/${engine}.js`);

  const docs = await mod.getDocuments();
  let done = 0, skipped = 0, saved = 0;
  const details = [];

  for (const d of docs) {
    const file = await mod.getDocumentFile(d.id);
    if (!file?.data) { skipped++; continue; }
    const before = file.data.length ?? file.data.byteLength ?? 0;
    if (before < 50_000) { skipped++; continue; }
    const compressed = await compressPdfBuffer(Buffer.from(file.data));
    const after = compressed.length;
    if (after < before * 0.95) {
      await mod.updateDocument(d.id, { file_data: compressed });
      done++;
      saved += before - after;
      details.push({ id: d.id, filename: d.filename, before, after });
    } else {
      skipped++;
    }
  }

  return Response.json({ engine, total: docs.length, compressed: done, skipped, savedBytes: saved, details });
}
