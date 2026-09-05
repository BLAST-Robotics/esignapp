import crypto from 'node:crypto';
import { getPostgresUrl } from './engine.js';

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

let poolPromise = null;
async function getPool() {
  if (!poolPromise) {
    const { createPool } = await import('@vercel/postgres');
    poolPromise = createPool({ connectionString: getPostgresUrl() });
  }
  return poolPromise;
}

async function withClient(fn) {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function initTable() {
  await withClient(async (client) => {
    await client.sql`
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        title VARCHAR(255) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        file_data BYTEA,
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

export async function createDocument({ title, filename, fileBuffer, filePath, userId }) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const existing = await getDocuments();
  const slug = await uniqueSlug(title, existing);
  return await withClient(async (client) => {
    await client.sql`
      INSERT INTO documents (id, user_id, title, filename, file_path, file_data, slug, status, settings, created_at, updated_at)
      VALUES (${id}, ${userId || null}, ${title}, ${filename}, ${filename}, ${fileBuffer}, ${slug}, 'draft', '{}', ${now}, ${now})
    `;
    return id;
  });
}

export async function getDocuments({ userId } = {}) {
  return await withClient(async (client) => {
    let query;
    if (userId) {
      query = client.sql`
        SELECT d.id, d.user_id, d.title, d.filename, d.file_path, d.slug, d.status, d.collect_email, d.settings, d.created_at, d.updated_at, COUNT(s.id)::int as signature_count FROM documents d
        LEFT JOIN signatures s ON s.document_id = d.id
        WHERE d.user_id = ${userId}
        GROUP BY d.id
        ORDER BY d.created_at DESC
      `;
    } else {
      query = client.sql`
        SELECT d.id, d.user_id, d.title, d.filename, d.file_path, d.slug, d.status, d.collect_email, d.settings, d.created_at, d.updated_at, COUNT(s.id)::int as signature_count FROM documents d
        LEFT JOIN signatures s ON s.document_id = d.id
        GROUP BY d.id
        ORDER BY d.created_at DESC
      `;
    }
    const { rows } = await query;
    return rows;
  });
}

export async function getDocument(id) {
  return await withClient(async (client) => {
    const { rows: docs } = await client.sql`
      SELECT id, user_id, title, filename, file_path, slug, status, collect_email, settings, created_at, updated_at 
      FROM documents WHERE id = ${id}
    `;
    if (docs.length === 0) return null;
    const { rows: fields } =
      await client.sql`SELECT * FROM document_fields WHERE document_id = ${id} ORDER BY sort_order`;
    return { ...docs[0], fields };
  });
}

export async function getDocumentBySlug(slug) {
  return await withClient(async (client) => {
    const { rows: docs } = await client.sql`
      SELECT id, user_id, title, filename, file_path, slug, status, collect_email, settings, created_at, updated_at 
      FROM documents WHERE slug = ${slug}
    `;
    if (docs.length === 0) return null;
    const { rows: fields } =
      await client.sql`SELECT * FROM document_fields WHERE document_id = ${docs[0].id} ORDER BY sort_order`;
    return { ...docs[0], fields };
  });
}

export async function getDocumentFile(id) {
  return await withClient(async (client) => {
    const { rows } = await client.sql`SELECT file_data, filename FROM documents WHERE id = ${id}`;
    if (rows.length === 0) return null;
    return { data: rows[0].file_data, filename: rows[0].filename };
  });
}

export async function updateDocument(id, updates) {
  return await withClient(async (client) => {
    const fieldKeys = Object.keys(updates).filter((k) => k !== 'fields');
    if (fieldKeys.length === 0) return;
    const setClauses = fieldKeys.map((k, i) => {
      const col = k.replace(/([A-Z])/g, '_$1').toLowerCase();
      return `${col} = $${i + 1}`;
    });
    const values = fieldKeys.map((k) => {
      if (k === 'file_data') return Buffer.isBuffer(updates[k]) ? updates[k] : updates[k];
      if (typeof updates[k] === 'object') return JSON.stringify(updates[k]);
      return updates[k];
    });
    const queryStr = `UPDATE documents SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${fieldKeys.length + 1}`;
    values.push(id);
    await client.query(queryStr, values);
  });
}

export async function deleteDocument(id) {
  return await withClient(async (client) => {
    await client.sql`DELETE FROM documents WHERE id = ${id}`;
  });
}

export async function saveDocumentFields(documentId, fields) {
  return await withClient(async (client) => {
    await client.sql`DELETE FROM document_fields WHERE document_id = ${documentId}`;
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      if (f.id) {
        await client.sql`
          INSERT INTO document_fields (id, document_id, label, field_type, x, y, width, height, font_size, date_format, required, page_number, sort_order)
          VALUES (${f.id}, ${documentId}, ${f.label}, ${f.fieldType || f.field_type}, ${f.x}, ${f.y}, ${f.width}, ${f.height}, ${f.font_size || f.fontSize || null}, ${f.date_format || null}, ${f.required !== false}, ${f.page_number || 0}, ${i})
        `;
      } else {
        await client.sql`
          INSERT INTO document_fields (document_id, label, field_type, x, y, width, height, font_size, date_format, required, page_number, sort_order)
          VALUES (${documentId}, ${f.label}, ${f.fieldType || f.field_type}, ${f.x}, ${f.y}, ${f.width}, ${f.height}, ${f.font_size || f.fontSize || null}, ${f.date_format || null}, ${f.required !== false}, ${f.page_number || 0}, ${i})
        `;
      }
    }
  });
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
  return await withClient(async (client) => {
    const { rows } = await client.sql`
      INSERT INTO signatures (document_id, field_values, signer_email, ip_address, ipv4, ipv6, ip_location)
      VALUES (${documentId || null}, ${JSON.stringify(fieldValues || {})}, ${signerEmail || null}, ${ipAddress}, ${ipv4 || null}, ${ipv6 || null}, ${ipLocation || null})
      RETURNING id
    `;
    return rows[0].id;
  });
}

export async function getSignatures(documentId) {
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

export async function getSignature(id) {
  return await withClient(async (client) => {
    const { rows } = await client.sql`SELECT * FROM signatures WHERE id = ${Number(id) || id}`;
    return rows[0] || null;
  });
}

export async function updateSignature(id, { fieldValues } = {}) {
  return await withClient(async (client) => {
    if (fieldValues) {
      await client.sql`UPDATE signatures SET field_values = ${JSON.stringify(fieldValues)} WHERE id = ${Number(id) || id}`;
    }
  });
}

export async function deleteSignature(id) {
  return await withClient(async (client) => {
    await client.sql`DELETE FROM signatures WHERE id = ${Number(id) || id}`;
  });
}
