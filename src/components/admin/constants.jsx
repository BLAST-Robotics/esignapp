'use client';

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

export function setToken(t) {
  try {
    if (t) localStorage.setItem('ks_token', t);
    else localStorage.removeItem('ks_token');
  } catch {}
}

export function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
