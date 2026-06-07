import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export function formatDate(iso, format = 'MMMM D, YYYY') {
  const d = new Date(iso);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const m = months[d.getMonth()];
  const dd = d.getDate();
  const yyyy = d.getFullYear();
  const h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;

  return format
    .replace('MMMM', m)
    .replace('MMM', m.slice(0, 3))
    .replace('D', String(dd))
    .replace('YYYY', String(yyyy))
    .replace('YY', String(yyyy).slice(2))
    .replace('hh', String(h12))
    .replace('mm', min)
    .replace('A', ampm);
}

export async function stampPdf(doc, { field_values, created_at, document_id }, docWithFields = null) {
  const pages = doc.getPages();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const values = field_values || {};
  const fields = docWithFields?.fields || [];

  for (const f of fields) {
    const val = values[f.id] || '';
    if (!val) continue;

    const pageIdx = f.page_number ? f.page_number - 1 : pages.length - 1;
    const targetPage = pages[pageIdx] || pages[pages.length - 1];
    const { height } = targetPage.getSize();
    const x = f.x || 0;

    if (f.field_type === 'signature') {
      const base64Data = val.replace(/^data:image\/\w+;base64,/, '');
      try {
        const img = await doc.embedPng(base64Data);
        const nat = img.scale(1);
        const boxH = f.height || 100;
        const aspect = nat.width / nat.height;
        const drawH = Math.min(boxH, nat.height);
        const drawW = drawH * aspect;
        targetPage.drawImage(img, {
          x,
          y: height - (f.y || 0) - drawH,
          width: drawW,
          height: drawH,
        });
      } catch {}
    } else if (f.field_type === 'date') {
      const fs = f.font_size || 12;
      const displayVal = f.date_format?.startsWith('signing') ? formatDate(new Date().toISOString(), 'MMMM D, YYYY') : val;
      targetPage.drawText(displayVal, {
        x,
        y: height - (f.y || 0) - fs * 0.716,
        size: fs,
        font,
        color: rgb(0, 0, 0),
      });
    } else {
      const fs = f.font_size || 12;
      targetPage.drawText(val, {
        x,
        y: height - (f.y || 0) - fs * 0.716,
        size: fs,
        font,
        color: rgb(0, 0, 0),
      });
    }
  }
}
