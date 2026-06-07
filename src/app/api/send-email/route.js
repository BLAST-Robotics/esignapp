import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { getSettings } from '@/lib/settings';
import { stampPdf } from '@/lib/stampPdf';
import { getSignature } from '@/lib/storage';

export async function POST(request) {
  try {
    const { email, id } = await request.json();
    if (!email?.trim() || !id) {
      return Response.json({ error: 'Email and signature ID are required.' }, { status: 400 });
    }

    const row = await getSignature(id);
    if (!row) {
      return Response.json({ error: 'Signature not found.' }, { status: 404 });
    }

    const pdfPath = path.join(process.cwd(), 'public', 'handbook.pdf');
    let pdfBytes;
    try {
      pdfBytes = await fs.readFile(pdfPath);
    } catch {
      return Response.json({ error: 'handbook.pdf not found.' }, { status: 404 });
    }

    const settings = await getSettings();
    const doc = await PDFDocument.load(pdfBytes);
    await stampPdf(doc, row, settings);
    const modifiedPdf = await doc.save();

    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@esign.app',
      to: email.trim(),
      subject: 'Your Signed Summer Camp Handbook',
      text: `Thank you for signing the summer camp handbook for ${row.child_name}.\n\nYour signed document is attached.\n\n- Summer Camp Team`,
      attachments: [
        {
          filename: `signed-handbook-${row.child_name.replace(/\s+/g, '_')}.pdf`,
          content: Buffer.from(modifiedPdf),
        },
      ],
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Send email error:', error);
    return Response.json({ error: 'Failed to send email. Check SMTP configuration.' }, { status: 500 });
  }
}
