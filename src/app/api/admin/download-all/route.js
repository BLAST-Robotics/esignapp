import { PDFDocument } from 'pdf-lib';
import { requireAuth } from '@/lib/auth';
import { stampPdf } from '@/lib/stampPdf';
import { getDocument, getDocumentFile, getSignature, getSignatures } from '@/lib/storage';

export async function GET(request) {
  const user = await requireAuth(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const all = await getSignatures();
    if (all.length === 0) return Response.json({ error: 'No signatures found' }, { status: 404 });

    const mergedDoc = await PDFDocument.create();

    for (const sig of all) {
      const full = await getSignature(sig.id);
      if (!full) continue;

      let pdfBytes;
      let docWithFields = null;

      if (full.document_id) {
        docWithFields = await getDocument(full.document_id);
        if (!docWithFields) continue;
        const file = await getDocumentFile(full.document_id);
        if (!file) continue;
        pdfBytes = file.data;
      } else {
        continue;
      }

      const subDoc = await PDFDocument.load(pdfBytes);
      await stampPdf(subDoc, full, docWithFields);

      const subPages = await mergedDoc.copyPages(subDoc, subDoc.getPageIndices());
      for (const page of subPages) mergedDoc.addPage(page);
    }

    const mergedPdf = await mergedDoc.save();

    return new Response(mergedPdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="all-signed-documents.pdf"',
      },
    });
  } catch (error) {
    console.error('Download-all error:', error);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
