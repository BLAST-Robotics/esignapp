import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
const uuidv4 = () => crypto.randomUUID();

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'untitled';
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
const SIG_FILE = path.join(DATA_DIR, 'signatures.json');
const DOC_FILE = path.join(DATA_DIR, 'documents.json');

function usePostgres() {
  return !!process.env.POSTGRES_URL && process.env.POSTGRES_URL !== 'postgres://placeholder:placeholder@localhost:5432/placeholder';
}

// ─── JSON file helpers ──────────────────────────────────────────

async function ensureJSON(file, initial) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { await fs.access(file); }
  catch { await fs.writeFile(file, JSON.stringify(initial, null, 2), 'utf-8'); }
}

async function readJSON(file) {
  await ensureJSON(file, []);
  const raw = await fs.readFile(file, 'utf-8');
  return JSON.parse(raw);
}

async function writeJSON(file, data) {
  await ensureJSON(file, []);
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── DB pool helper ─────────────────────────────────────────────

let poolPromise = null;
async function getPool() {
  if (!poolPromise) {
    const { createPool } = await import('@vercel/postgres');
    poolPromise = createPool({ connectionString: process.env.POSTGRES_URL });
  }
  return poolPromise;
}

async function withClient(fn) {
  const pool = await getPool();
  const client = await pool.connect();
  try { return await fn(client); }
  finally { client.release(); }
}

// ─── Init tables ────────────────────────────────────────────────

export async function initTable() {
  if (!usePostgres()) return;
  await withClient(async (client) => {
    await client.sql`
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        title VARCHAR(255) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        slug VARCHAR(255) UNIQUE,
        status VARCHAR(50) DEFAULT 'draft',
        collect_email BOOLEAN DEFAULT false,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await client.sql`
      CREATE TABLE IF NOT EXISTS document_fields (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
        label VARCHAR(255) NOT NULL,
        field_type VARCHAR(50) NOT NULL,
        x DOUBLE PRECISION DEFAULT 0,
        y DOUBLE PRECISION DEFAULT 0,
        width DOUBLE PRECISION DEFAULT 200,
        height DOUBLE PRECISION DEFAULT 40,
        font_size DOUBLE PRECISION,
        date_format VARCHAR(50),
        required BOOLEAN DEFAULT true,
        page_number INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0
      )
    `;
    await client.sql`
      CREATE TABLE IF NOT EXISTS signatures (
        id SERIAL PRIMARY KEY,
        document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
        field_values JSONB DEFAULT '{}',
        signer_email VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        ip_address VARCHAR(45),
        ipv4 VARCHAR(45),
        ipv6 VARCHAR(45),
        ip_location TEXT
      )
    `;
  });
}

// ─── Documents ──────────────────────────────────────────────────

export async function createDocument({ title, filename, filePath, userId }) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const existing = await getDocuments();
  const slug = await uniqueSlug(title, existing);
  if (usePostgres()) {
    return await withClient(async (client) => {
      await client.sql`
        INSERT INTO documents (id, user_id, title, filename, file_path, slug, status, settings, created_at, updated_at)
        VALUES (${id}, ${userId || null}, ${title}, ${filename}, ${filePath}, ${slug}, 'draft', '{}', ${now}, ${now})
      `;
      return id;
    });
  }
  const docs = await readJSON(DOC_FILE);
  docs.push({ id, user_id: userId || null, title, filename, file_path: filePath, slug, status: 'draft', collect_email: false, settings: {}, created_at: now, updated_at: now, fields: [] });
  await writeJSON(DOC_FILE, docs);
  return id;
}

export async function getDocuments({ userId } = {}) {
  if (usePostgres()) {
    return await withClient(async (client) => {
      let query;
      if (userId) {
        query = client.sql`
          SELECT d.*, COUNT(s.id)::int as signature_count FROM documents d
          LEFT JOIN signatures s ON s.document_id = d.id
          WHERE d.user_id = ${userId}
          GROUP BY d.id
          ORDER BY d.created_at DESC
        `;
      } else {
        query = client.sql`
          SELECT d.*, COUNT(s.id)::int as signature_count FROM documents d
          LEFT JOIN signatures s ON s.document_id = d.id
          GROUP BY d.id
          ORDER BY d.created_at DESC
        `;
      }
      const { rows } = await query;
      return rows;
    });
  }
  const docs = await readJSON(DOC_FILE);
  const sigs = await readJSON(SIG_FILE);
  let filtered = docs;
  if (userId) filtered = docs.filter(d => d.user_id === userId);
  return filtered.map(d => ({
    ...d,
    signature_count: sigs.filter(s => s.document_id === d.id).length,
  })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function getDocument(id) {
  if (usePostgres()) {
    return await withClient(async (client) => {
      const { rows: docs } = await client.sql`SELECT * FROM documents WHERE id = ${id}`;
      if (docs.length === 0) return null;
      const { rows: fields } = await client.sql`SELECT * FROM document_fields WHERE document_id = ${id} ORDER BY sort_order`;
      return { ...docs[0], fields };
    });
  }
  const docs = await readJSON(DOC_FILE);
  const doc = docs.find(d => d.id === id);
  return doc || null;
}

export async function getDocumentBySlug(slug) {
  if (usePostgres()) {
    return await withClient(async (client) => {
      const { rows: docs } = await client.sql`SELECT * FROM documents WHERE slug = ${slug}`;
      if (docs.length === 0) return null;
      const { rows: fields } = await client.sql`SELECT * FROM document_fields WHERE document_id = ${docs[0].id} ORDER BY sort_order`;
      return { ...docs[0], fields };
    });
  }
  const docs = await readJSON(DOC_FILE);
  return docs.find((d) => d.slug === slug) || null;
}

export async function updateDocument(id, updates) {
  const now = new Date().toISOString();
  if (usePostgres()) {
    return await withClient(async (client) => {
      const sets = Object.entries({ ...updates, updated_at: now })
        .filter(([k]) => k !== 'fields')
        .map(([k, v]) => `${k.replace(/([A-Z])/g, '_$1').toLowerCase()} = ${typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v}`)
        .join(', ');
      await client.sql`UPDATE documents SET ${sets} WHERE id = ${id}`;
    });
  }
  const docs = await readJSON(DOC_FILE);
  const idx = docs.findIndex(d => d.id === id);
  if (idx === -1) throw new Error('Document not found');
  Object.assign(docs[idx], updates, { updated_at: now });
  await writeJSON(DOC_FILE, docs);
}

export async function deleteDocument(id) {
  if (usePostgres()) {
    return await withClient(async (client) => {
      await client.sql`DELETE FROM documents WHERE id = ${id}`;
    });
  }
  let docs = await readJSON(DOC_FILE);
  docs = docs.filter(d => d.id !== id);
  await writeJSON(DOC_FILE, docs);
  // also delete related signatures
  let sigs = await readJSON(SIG_FILE);
  sigs = sigs.filter(s => s.document_id !== id);
  await writeJSON(SIG_FILE, sigs);
}

// ─── Document fields ────────────────────────────────────────────

export async function saveDocumentFields(documentId, fields) {
  if (usePostgres()) {
    return await withClient(async (client) => {
      await client.sql`DELETE FROM document_fields WHERE document_id = ${documentId}`;
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        await client.sql`
          INSERT INTO document_fields (document_id, label, field_type, x, y, width, height, font_size, date_format, required, page_number, sort_order)
          VALUES (${documentId}, ${f.label}, ${f.fieldType || f.field_type}, ${f.x}, ${f.y}, ${f.width}, ${f.height}, ${f.font_size || f.fontSize || null}, ${f.date_format || null}, ${f.required !== false}, ${f.page_number || 0}, ${i})
        `;
      }
    });
  }
  const docs = await readJSON(DOC_FILE);
  const doc = docs.find(d => d.id === documentId);
  if (!doc) throw new Error('Document not found');
  doc.fields = fields.map((f, i) => ({
    id: f.id || uuidv4(),
    document_id: documentId,
    label: f.label,
    field_type: f.fieldType || f.field_type,
    x: f.x, y: f.y,
    width: f.width, height: f.height,
    font_size: f.font_size || f.fontSize || null,
    date_format: f.date_format || null,
    required: f.required !== false,
    page_number: f.page_number || 0,
    sort_order: i,
  }));
  await writeJSON(DOC_FILE, docs);
}

// ─── Document Settings ──────────────────────────────────────────

export async function getDocumentSettings(documentId) {
  const doc = await getDocument(documentId);
  if (!doc) return null;
  return doc.settings || {};
}

export async function updateDocumentSettings(documentId, settings) {
  await updateDocument(documentId, { settings: JSON.stringify(settings) });
}

// ─── Signatures (updated with document awareness) ───────────────

export async function insertSignature({ documentId, fieldValues, signerEmail, ipAddress, ipv4, ipv6, ipLocation }) {
  if (usePostgres()) {
    return await withClient(async (client) => {
      const { rows } = await client.sql`
        INSERT INTO signatures (document_id, field_values, signer_email, ip_address, ipv4, ipv6, ip_location)
        VALUES (${documentId || null}, ${JSON.stringify(fieldValues || {})}, ${signerEmail || null}, ${ipAddress}, ${ipv4 || null}, ${ipv6 || null}, ${ipLocation || null})
        RETURNING id
      `;
      return rows[0].id;
    });
  }

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
  if (usePostgres()) {
    return await withClient(async (client) => {
      let query;
      if (documentId) {
        query = client.sql`
          SELECT * FROM signatures WHERE document_id = ${documentId} ORDER BY created_at DESC
        `;
      } else {
        query = client.sql`
          SELECT * FROM signatures ORDER BY created_at DESC
        `;
      }
      const { rows } = await query;
      return rows;
    });
  }

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
  if (usePostgres()) {
    return await withClient(async (client) => {
      const { rows } = await client.sql`SELECT * FROM signatures WHERE id = ${Number(id) || id}`;
      return rows[0] || null;
    });
  }

  const records = await readJSON(SIG_FILE);
  const numId = Number(id);
  return records.find((r) => r.id === numId || r.id === id) || null;
}

export async function updateSignature(id, { fieldValues } = {}) {
  if (usePostgres()) {
    return await withClient(async (client) => {
      if (fieldValues) {
        await client.sql`UPDATE signatures SET field_values = ${JSON.stringify(fieldValues)} WHERE id = ${Number(id) || id}`;
      }
    });
  }

  const records = await readJSON(SIG_FILE);
  const idx = records.findIndex((r) => r.id === Number(id) || r.id === id);
  if (idx === -1) throw new Error('Not found');
  if (fieldValues) records[idx].field_values = fieldValues;
  await writeJSON(SIG_FILE, records);
}

export async function deleteSignature(id) {
  if (usePostgres()) {
    return await withClient(async (client) => {
      await client.sql`DELETE FROM signatures WHERE id = ${Number(id) || id}`;
    });
  }

  const records = await readJSON(SIG_FILE);
  const filtered = records.filter((r) => r.id !== Number(id) && r.id !== id);
  if (filtered.length === records.length) throw new Error('Not found');
  await writeJSON(SIG_FILE, filtered);
}
