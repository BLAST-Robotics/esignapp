import fs from 'node:fs/promises';
import path from 'node:path';
import { requireAuth } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { createDocument, getDocuments, saveDocumentFields } from '@/lib/storage';

export async function POST(request) {
  const user = await requireAuth(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Check if handbook.pdf exists
    const pdfPath = path.join(process.cwd(), 'public', 'handbook.pdf');
    try {
      await fs.access(pdfPath);
    } catch {
      return Response.json({ error: 'handbook.pdf not found in public/' }, { status: 404 });
    }

    // Check if already migrated
    const docs = await getDocuments();
    const existing = docs.find((d) => d.title === 'Handbook' || d.filename?.startsWith('handbook'));
    if (existing) {
      return Response.json({ success: true, documentId: existing.id, message: 'Already migrated' });
    }

    // Copy handbook.pdf to .data/uploads
    const uploadsDir = path.join(process.cwd(), '.data', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const destPath = path.join(uploadsDir, 'handbook.pdf');
    await fs.copyFile(pdfPath, destPath);

    // Create document
    const id = await createDocument({
      title: 'Handbook',
      filename: 'handbook.pdf',
      filePath: destPath,
    });

    // Migrate settings to fields
    const settings = await getSettings();
    const fieldMap = {
      childName: { field_type: 'name', label: 'Name' },
      parentName: { field_type: 'name', label: 'Name' },
      signature: { field_type: 'signature', label: 'Signature' },
      signedDate: { field_type: 'date', label: 'Date', date_format: 'signing' },
    };

    const fields = [];
    for (const [key, meta] of Object.entries(fieldMap)) {
      const pos = settings[key];
      if (!pos) continue;
      fields.push({
        id: crypto.randomUUID(),
        x: pos.x,
        y: pos.y,
        width: pos.width || 200,
        height: pos.height || 40,
        font_size: pos.fontSize || 14,
        label: meta.label,
        field_type: meta.field_type,
        date_format: meta.date_format || null,
        required: true,
      });
    }

    await saveDocumentFields(id, fields);
    // Update status to active
    const { updateDocument } = await import('@/lib/storage');
    await updateDocument(id, { status: 'active' });

    return Response.json({ success: true, documentId: id });
  } catch (error) {
    console.error('Migration error:', error);
    return Response.json({ error: 'Migration failed' }, { status: 500 });
  }
}
