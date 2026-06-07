import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const uuidv4 = () => crypto.randomUUID();

function slugify(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'untitled'
  );
}

async function uniqueSlug(base, existingDocs) {
  let slug = slugify(base);
  if (!slug) slug = 'doc';
  const used = new Set(existingDocs.map((d) => d.slug).filter(Boolean));
  if (!used.has(slug)) return slug;
  for (let i = 1; i < 1000; i++) {
    const candidate = `${slug}-${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${slug}-${Date.now()}`;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const DOC_FILE = path.join(DATA_DIR, 'documents.json');
const SIG_FILE = path.join(DATA_DIR, 'signatures.json');

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function ensureJSON(file, initial) {
  await ensureDir();
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, JSON.stringify(initial, null, 2), 'utf-8');
  }
}

const MIGRATIONS = {
  [DOC_FILE]: (doc) => {
    let c = false;
    if (doc.settings === undefined) {
      doc.settings = {};
      c = true;
    }
    if (doc.collect_email === undefined) {
      doc.collect_email = false;
      c = true;
    }
    if (doc.fields === undefined) {
      doc.fields = [];
      c = true;
    }
    if (doc.status === undefined) {
      doc.status = 'draft';
      c = true;
    }
    return c;
  },
  [SIG_FILE]: (sig) => {
    let c = false;
    if (sig.signer_email === undefined) {
      sig.signer_email = null;
      c = true;
    }
    if (sig.ipv4 === undefined) {
      sig.ipv4 = null;
      c = true;
    }
    if (sig.ipv6 === undefined) {
      sig.ipv6 = null;
      c = true;
    }
    if (sig.ip_location === undefined) {
      sig.ip_location = null;
      c = true;
    }
    if (sig.field_values === undefined) {
      sig.field_values = {};
      c = true;
    } else if (typeof sig.field_values === 'string') {
      sig.field_values = JSON.parse(sig.field_values);
      c = true;
    }
    return c;
  },
};

async function readJSON(file) {
  await ensureJSON(file, []);
  const raw = await fs.readFile(file, 'utf-8');
  const data = JSON.parse(raw);
  const migrate = MIGRATIONS[file];
  if (migrate && Array.isArray(data)) {
    let changed = false;
    for (const item of data) {
      if (migrate(item)) changed = true;
    }
    if (changed) await writeJSON(file, data);
  }
  return data;
}

async function writeJSON(file, data) {
  await ensureJSON(file, []);
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
}

export async function initTable() {}

export async function createDocument({ title, filename, fileBuffer, filePath, userId }) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const existing = await getDocuments();
  const slug = await uniqueSlug(title, existing);
  const docs = await readJSON(DOC_FILE);
  docs.push({
    id,
    user_id: userId || null,
    title,
    filename,
    file_path: filePath || filename,
    slug,
    status: 'draft',
    collect_email: false,
    settings: {},
    created_at: now,
    updated_at: now,
    fields: [],
  });
  await writeJSON(DOC_FILE, docs);
  return id;
}

export async function getDocuments({ userId } = {}) {
  const docs = await readJSON(DOC_FILE);
  const sigs = await readJSON(SIG_FILE);
  let filtered = docs;
  if (userId) filtered = docs.filter((d) => d.user_id === userId);
  return filtered
    .map((d) => ({
      ...d,
      signature_count: sigs.filter((s) => s.document_id === d.id).length,
    }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function getDocument(id) {
  const docs = await readJSON(DOC_FILE);
  return docs.find((d) => d.id === id) || null;
}

export async function getDocumentBySlug(slug) {
  const docs = await readJSON(DOC_FILE);
  return docs.find((d) => d.slug === slug) || null;
}

export async function getDocumentFile(id) {
  const docs = await readJSON(DOC_FILE);
  const doc = docs.find((d) => d.id === id);
  if (!doc?.file_path) return null;
  const data = await fs.readFile(doc.file_path);
  return { data, filename: doc.filename };
}

export async function updateDocument(id, updates) {
  const now = new Date().toISOString();
  const docs = await readJSON(DOC_FILE);
  const idx = docs.findIndex((d) => d.id === id);
  if (idx === -1) throw new Error('Document not found');
  Object.assign(docs[idx], updates, { updated_at: now });
  await writeJSON(DOC_FILE, docs);
}

export async function deleteDocument(id) {
  let docs = await readJSON(DOC_FILE);
  docs = docs.filter((d) => d.id !== id);
  await writeJSON(DOC_FILE, docs);
  let sigs = await readJSON(SIG_FILE);
  sigs = sigs.filter((s) => s.document_id !== id);
  await writeJSON(SIG_FILE, sigs);
}

export async function saveDocumentFields(documentId, fields) {
  const docs = await readJSON(DOC_FILE);
  const doc = docs.find((d) => d.id === documentId);
  if (!doc) throw new Error('Document not found');
  doc.fields = fields.map((f, i) => ({
    id: f.id || uuidv4(),
    document_id: documentId,
    label: f.label,
    field_type: f.fieldType || f.field_type,
    x: f.x,
    y: f.y,
    width: f.width,
    height: f.height,
    font_size: f.font_size || f.fontSize || null,
    date_format: f.date_format || null,
    required: f.required !== false,
    page_number: f.page_number || 0,
    sort_order: i,
  }));
  await writeJSON(DOC_FILE, docs);
}

export async function getDocumentSettings(documentId) {
  const doc = await getDocument(documentId);
  if (!doc) return null;
  return doc.settings || {};
}

export async function updateDocumentSettings(documentId, settings) {
  await updateDocument(documentId, { settings: JSON.stringify(settings) });
}

export async function insertSignature({ documentId, fieldValues, signerEmail, ipAddress, ipv4, ipv6, ipLocation }) {
  const records = await readJSON(SIG_FILE);
  const record = {
    id: records.length > 0 ? Math.max(...records.map((r) => Number(r.id))) + 1 : 1,
    document_id: documentId || null,
    field_values: fieldValues || {},
    signer_email: signerEmail || null,
    created_at: new Date().toISOString(),
    ip_address: ipAddress,
    ipv4: ipv4 || null,
    ipv6: ipv6 || null,
    ip_location: ipLocation || null,
  };
  records.push(record);
  await writeJSON(SIG_FILE, records);
  return record.id;
}

export async function getSignatures(documentId) {
  const records = await readJSON(SIG_FILE);
  let filtered = records;
  if (documentId) {
    filtered = records.filter((r) => r.document_id === documentId);
  }
  return filtered
    .map((r) => ({
      id: r.id,
      document_id: r.document_id,
      field_values: r.field_values || {},
      created_at: r.created_at,
      ip_address: r.ip_address,
      ipv4: r.ipv4,
      ipv6: r.ipv6,
      ip_location: r.ip_location,
    }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function getSignature(id) {
  const records = await readJSON(SIG_FILE);
  const numId = Number(id);
  return records.find((r) => r.id === numId || r.id === id) || null;
}

export async function updateSignature(id, { fieldValues } = {}) {
  const records = await readJSON(SIG_FILE);
  const idx = records.findIndex((r) => r.id === Number(id) || r.id === id);
  if (idx === -1) throw new Error('Not found');
  if (fieldValues) records[idx].field_values = fieldValues;
  await writeJSON(SIG_FILE, records);
}

export async function deleteSignature(id) {
  const records = await readJSON(SIG_FILE);
  const filtered = records.filter((r) => r.id !== Number(id) && r.id !== id);
  if (filtered.length === records.length) throw new Error('Not found');
  await writeJSON(SIG_FILE, filtered);
}
