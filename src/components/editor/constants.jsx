'use client';

export function genId() {
  try {
    return crypto.randomUUID();
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
}

export function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch {}
    document.body.removeChild(ta);
  }
}

export function toLocalISO(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function getToken() {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem('ks_token') || '';
  } catch {
    return '';
  }
}

export const FIELD_TYPES = [
  { value: 'name', label: 'Name', icon: 'Aa' },
  { value: 'signature', label: 'Signature', icon: '\u270D' },
  { value: 'date', label: 'Date', icon: '\uD83D\uDCC5' },
  { value: 'email', label: 'Email', icon: '@' },
  { value: 'phone', label: 'Phone', icon: '\u260E' },
  { value: 'other', label: 'Other', icon: '\u2699' },
];

export const FIELD_COLORS = {
  name: { bg: 'rgba(16,185,129,0.12)', border: '#10b981' },
  signature: { bg: 'rgba(59,130,246,0.12)', border: '#3b82f6' },
  date: { bg: 'rgba(139,92,246,0.12)', border: '#8b5cf6' },
  email: { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b' },
  phone: { bg: 'rgba(236,72,153,0.12)', border: '#ec4899' },
  other: { bg: 'rgba(107,114,128,0.12)', border: '#6b7280' },
};

export const VALIDATION_OPTIONS = [
  { value: 'none', label: 'No validation' },
  { value: 'required', label: 'Required' },
  { value: 'email', label: 'Valid email' },
  { value: 'phone', label: 'Valid phone' },
  { value: 'min2', label: 'Min 2 characters' },
];