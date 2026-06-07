import { Archiver } from 'archiver';
import { PDFDocument } from 'pdf-lib';
import { requireAuth } from '@/lib/auth';
import { stampPdf } from '@/lib/stampPdf';
import { getDocument, getDocumentFile, getSignature, getSignatures } from '@/lib/storage';

export async function GET(request, { params }) {
  const user = await requireAuth(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  try {
    const doc = await getDocument(id);
    if (!doc) return Response.json({ error: 'Not found' }, { status: 404 });

    const sigs = await getSignatures(id);
    if (sigs.length === 0) return Response.json({ error: 'No signatures' }, { status: 404 });

    const file = await getDocumentFile(id);
    if (!file) return Response.json({ error: 'Document file not found' }, { status: 404 });
    const pdfBytes = file.data;

    const chunks = [];
    const archive = new Archiver('zip', { zlib: { level: 9 } });
    const promise = new Promise((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);
      archive.on('data', (c) => chunks.push(c));
    });

    for (const sig of sigs) {
      const full = await getSignature(sig.id);
      if (!full) continue;
      try {
        const subDoc = await PDFDocument.load(pdfBytes);
        await stampPdf(subDoc, full, doc);
        const stamped = await subDoc.save();
        archive.append(stamped, { name: `signature-${sig.id.slice(0, 8)}.pdf` });
      } catch {}
    }

    await archive.finalize();
    const buffer = await promise;

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="signed-${doc.slug || doc.id}.zip"`,
      },
    });
  } catch (error) {
    console.error('Download-all error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
