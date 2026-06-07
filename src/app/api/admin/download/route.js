import { PDFDocument } from 'pdf-lib';
import { requireAuth } from '@/lib/auth';
import { stampPdf } from '@/lib/stampPdf';
import { getDocument, getDocumentFile, getSignature } from '@/lib/storage';

export async function GET(request) {
  const user = await requireAuth(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  try {
    const row = await getSignature(id);
    if (!row) return Response.json({ error: 'Not found' }, { status: 404 });

    let pdfBytes;
    let docWithFields = null;

    if (row.document_id) {
      docWithFields = await getDocument(row.document_id);
      if (!docWithFields) {
        return Response.json({ error: 'Document file not found' }, { status: 404 });
      }
      const file = await getDocumentFile(row.document_id);
      if (!file) return Response.json({ error: 'Document file not found' }, { status: 404 });
      pdfBytes = file.data;
    } else {
      return Response.json({ error: 'Document file not found' }, { status: 404 });
    }

    const doc = await PDFDocument.load(pdfBytes);
    await stampPdf(doc, row, docWithFields);
    const modifiedPdf = await doc.save();

    return new Response(modifiedPdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="signed-document.pdf"`,
      },
    });
  } catch (error) {
    console.error('Admin download error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
