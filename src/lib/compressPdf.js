import { PDFDocument } from 'pdf-lib';

export async function compressPdfBuffer(inputBuffer) {
  if (!inputBuffer || inputBuffer.length < 100) return inputBuffer;
  // Skip tiny files or already-compressed (heuristic: if we can't parse, return original)
  try {
    const pdfDoc = await PDFDocument.load(inputBuffer, { ignoreEncryption: true });
    // pdf-lib's save with object streams + compression is the best we can do without ghostscript.
    // This rewrites xref, deduplicates, and flattens.
    const bytes = await pdfDoc.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 100 });
    const out = Buffer.from(bytes);
    // Only use compressed if actually smaller (avoid inflating)
    if (out.length < inputBuffer.length * 0.95) return out;
    return inputBuffer;
  } catch {
    return inputBuffer;
  }
}
