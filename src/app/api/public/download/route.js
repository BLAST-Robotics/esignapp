import { getSignature, getDocument } from '@/lib/storage';
import { stampPdf } from '@/lib/stampPdf';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const mode = searchParams.get('mode') || 'download';

  if (!id) return Response.json({ error: 'Missing id parameter' }, { status: 400 });

  try {
    const row = await getSignature(id);
    if (!row) return Response.json({ error: 'Signature not found' }, { status: 404 });

    let pdfBytes;
    let docWithFields = null;

    if (row.document_id) {
      docWithFields = await getDocument(row.document_id);
      if (!docWithFields || !docWithFields.file_path) {
        return Response.json({ error: 'Document not found' }, { status: 404 });
      }
      pdfBytes = await fs.readFile(docWithFields.file_path);
    } else {
      return Response.json({ error: 'Document not found' }, { status: 404 });
    }

    const doc = await PDFDocument.load(pdfBytes);
    await stampPdf(doc, row, docWithFields);

    const modifiedPdf = await doc.save();

    return new Response(modifiedPdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': mode === 'view' ? 'inline' : `attachment; filename="signed-document.pdf"`,
      },
    });
  } catch (error) {
    console.error('Public download error:', error);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
