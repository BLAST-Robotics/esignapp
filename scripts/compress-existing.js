#!/usr/bin/env node
// Compress existing PDFs: local (.data sqlite/json) and prod (postgres if DATABASE_URL set)
import { compressPdfBuffer } from '../src/lib/compressPdf.js';
import { getEngine } from '../src/lib/drivers/engine.js';

const engine = getEngine();
const mod = await import(`../src/lib/drivers/${engine}.js`);

const docs = await mod.getDocuments();
console.log(`Engine: ${engine} — found ${docs.length} documents`);

let done = 0, saved = 0, skipped = 0;
for (const d of docs) {
  const file = await mod.getDocumentFile(d.id);
  if (!file?.data) { skipped++; continue; }
  const before = file.data.length ?? file.data.byteLength ?? 0;
  if (before < 50_000) { skipped++; continue; } // skip tiny
  const compressed = await compressPdfBuffer(Buffer.from(file.data));
  const after = compressed.length;
  if (after < before * 0.95) {
    // updateDocument is engine-specific; use sqlite/postgres/json drivers' internal update
    // Fallback: direct SQL via getDb where available
    if (mod.updateDocument) {
      await mod.updateDocument(d.id, { file_data: compressed });
      console.log(`${d.id} ${d.filename}: ${(before/1024).toFixed(0)}KB → ${(after/1024).toFixed(0)}KB (-${((1-after/before)*100).toFixed(0)}%)`);
      saved += before - after;
      done++;
    }
  } else {
    skipped++;
  }
}
console.log(`Done: ${done} compressed, ${skipped} skipped, saved ${(saved/1024).toFixed(0)}KB`);

// Also compress public/handbook.pdf
import fs from 'node:fs';
import path from 'node:path';
const handbookPath = path.join(process.cwd(), 'public', 'handbook.pdf');
if (fs.existsSync(handbookPath)) {
  const buf = fs.readFileSync(handbookPath);
  const c = await compressPdfBuffer(buf);
  if (c.length < buf.length * 0.95) {
    fs.writeFileSync(handbookPath, c);
    console.log(`public/handbook.pdf: ${(buf.length/1024).toFixed(0)}KB → ${(c.length/1024).toFixed(0)}KB`);
  } else {
    console.log(`public/handbook.pdf: no savings (${(buf.length/1024).toFixed(0)}KB)`);
  }
}
