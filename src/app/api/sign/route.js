import { headers } from 'next/headers';
import { getDocument, getSignatures, initTable, insertSignature } from '@/lib/storage';
import { validateSignRequest } from '@/lib/validation';

const submitAttempts = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const window = 60_000;
  const max = 30;
  const entry = submitAttempts.get(ip) || { count: 0, resetAt: now + window };
  if (entry.resetAt < now) {
    entry.count = 0;
    entry.resetAt = now + window;
  }
  entry.count++;
  submitAttempts.set(ip, entry);
  return entry.count <= max;
}

function validateField(field, value) {
  if (field.field_type === 'date' && field.date_format?.startsWith('signing')) return null;
  const rule = field.validation || 'required';
  const val = (value || '').trim();
  if (rule === 'none') return null;
  if (rule === 'required' && !val) return 'This field is required';
  if (rule === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Please enter a valid email address';
  if (rule === 'phone' && !/^[\d\s\-()]{7,}$/.test(val)) return 'Please enter a valid phone number';
  if (rule === 'min2' && val.length < 2) return 'Must be at least 2 characters';
  return null;
}

function parseIPs(forwardedFor) {
  const ips = (forwardedFor || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  let ipv4 = null,
    ipv6 = null;
  for (const ip of ips) {
    if (ip.includes(':')) {
      if (!ipv6) ipv6 = ip;
    } else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      if (!ipv4) ipv4 = ip;
    }
  }
  return { ipv4, ipv6 };
}

const locationCache = new Map();
const LOCATION_TTL = 5 * 60 * 1000;

async function fetchLocation(ip) {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') return null;
  const cached = locationCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    const value = JSON.stringify({ city: data.city, region: data.region, country: data.country_name, org: data.org });
    locationCache.set(ip, { value, expiresAt: Date.now() + LOCATION_TTL });
    if (locationCache.size > 500) {
      const firstKey = locationCache.keys().next().value;
      locationCache.delete(firstKey);
    }
    return value;
  } catch {
    return null;
  }
}

export async function POST(request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    if (!rateLimit(ip)) {
      return Response.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
    }

    await initTable();
    const body = await request.json();
    const validation = validateSignRequest(body);
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: validation.status });
    }
    const { documentId, fieldValues, signerEmail } = body;

    const doc = await getDocument(documentId);
    if (!doc) {
      return Response.json({ error: 'Document not found.' }, { status: 404 });
    }
    if (doc.status !== 'active') {
      return Response.json({ error: 'Document is not available for signing.' }, { status: 403 });
    }

    // Prevent duplicate signature from same email
    if (signerEmail) {
      const existingSigs = await getSignatures(documentId);
      const alreadySigned = existingSigs.some(
        (s) => (s.signer_email || '').toLowerCase() === signerEmail.trim().toLowerCase(),
      );
      if (alreadySigned) {
        return Response.json({ error: 'Already signed from this email.' }, { status: 409 });
      }
    }

    const fields = doc.fields || [];
    const fieldErrors = {};
    for (const f of fields) {
      const msg = validateField(f, fieldValues[f.id]);
      if (msg) fieldErrors[f.id] = msg;
    }
    if (Object.keys(fieldErrors).length > 0) {
      return Response.json({ error: 'Validation failed.', fieldErrors }, { status: 422 });
    }

    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for') || '';
    const ipAddress = forwardedFor.split(',')[0]?.trim() || headersList.get('x-real-ip') || 'unknown';
    const { ipv4, ipv6 } = parseIPs(forwardedFor);
    const ipLocation = await fetchLocation(ipv4 || ipv6 || ipAddress);

    const sigId = await insertSignature({
      documentId,
      fieldValues,
      signerEmail: (signerEmail || '').trim().toLowerCase() || null,
      ipAddress,
      ipv4: ipv4 || null,
      ipv6: ipv6 || null,
      ipLocation,
    });

    return Response.json({ success: true, id: sigId });
  } catch (error) {
    console.error('Sign submission error:', error);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
