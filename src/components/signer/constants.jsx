'use client';

export const FIELD_RENDERERS = {
  name: { icon: 'Aa', placeholder: 'Enter name' },
  signature: { icon: '\u270D', placeholder: 'Tap to sign' },
  date: { icon: '\uD83D\uDCC5', placeholder: 'Date' },
  email: { icon: '@', placeholder: 'email@example.com' },
  phone: { icon: '\u260E', placeholder: 'Phone number' },
  other: { icon: '\u2699', placeholder: 'Enter value' },
};

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function formatDateTo(dateStr, format) {
  if (!dateStr) return '';
  const parts = dateStr.split('-').filter(Boolean).map(Number);
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return dateStr;
  const fmt = format || 'MMMM D, YYYY';
  return fmt.replace(/MMMM|YYYY|MM|DD|M|D|./g, (tok) => {
    switch (tok) {
      case 'MMMM':
        return MONTH_NAMES[m - 1];
      case 'YYYY':
        return String(y);
      case 'MM':
        return pad2(m);
      case 'DD':
        return pad2(d);
      case 'M':
        return String(m);
      case 'D':
        return String(d);
      default:
        return tok;
    }
  });
}

export function parseDateValue(val, format) {
  if (!val) return '';
  if (format === 'YYYY-MM-DD') return val;
  let m, d, y;
  if (format === 'MM/DD/YYYY' || format === 'DD/MM/YYYY') {
    const parts = val.split('/');
    if (parts.length !== 3) return '';
    if (format === 'MM/DD/YYYY') [m, d, y] = parts;
    else [d, m, y] = parts;
  } else {
    const ex = String(val).match(/^([A-Za-z]+) ?(\d{1,2})?,? (\d{4})$/);
    if (ex) {
      m = String(MONTH_NAMES.findIndex((n) => n.toLowerCase() === ex[1].toLowerCase()) + 1);
      d = ex[2];
      y = ex[3];
    }
  }
  if (!m || !d || !y) return '';
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function toISO(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export const DATE_FORMAT_TO_PICKER = {
  'MMMM D, YYYY': 'MMMM d, yyyy',
  'MM/DD/YYYY': 'MM/dd/yyyy',
  'DD/MM/YYYY': 'dd/MM/yyyy',
  'YYYY-MM-DD': 'yyyy-MM-dd',
};

export function isManualDate(field) {
  return field?.field_type === 'date' && !field.date_format?.startsWith('signing');
}