import crypto from 'node:crypto';

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

let db = null;
function getDb() {
  if (db) return db;
  const Database = require('better-sqlite3');
  const fs = require('node:fs');
  const path = require('node:path');
  const dir = path.join(process.cwd(), '.data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = new Database(path.join(dir, 'esign.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initTables(db);
  return db;
}

function initTables(d) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT NOT NULL,
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_data BLOB,
      slug TEXT UNIQUE,
      status TEXT DEFAULT 'draft',
      collect_email INTEGER DEFAULT 0,
      settings TEXT DEFAULT '{}',
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS document_fields (
      id TEXT PRIMARY KEY,
      document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      field_type TEXT NOT NULL,
      x REAL DEFAULT 0,
      y REAL DEFAULT 0,
      width REAL DEFAULT 200,
      height REAL DEFAULT 40,
      font_size REAL,
      date_format TEXT,
      required INTEGER DEFAULT 1,
      page_number INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS signatures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
      field_values TEXT DEFAULT '{}',
      signer_email TEXT,
      created_at TEXT,
      ip_address TEXT,
      ipv4 TEXT,
      ipv6 TEXT,
      ip_location TEXT
    );
  `);
}

export function initTable() {
  const d = getDb();
  initTables(d);
}

export async function createDocument({ title, filename, fileBuffer, filePath, userId }) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const existing = await getDocuments();
  const slug = await uniqueSlug(title, existing);
  const d = getDb();
  d.prepare(
    `INSERT INTO documents (id, user_id, title, filename, file_path, file_data, slug, status, settings, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', '{}', ?, ?)`,
  ).run(id, userId || null, title, filename, filename, fileBuffer || null, slug, now, now);
  return id;
}

export async function getDocuments({ userId } = {}) {
  const d = getDb();
  let rows;
  if (userId) {
    rows = d
      .prepare(
        `SELECT d.id, d.user_id, d.title, d.filename, d.file_path, d.slug, d.status, d.collect_email, d.settings, d.created_at, d.updated_at, (SELECT COUNT(*) FROM signatures s WHERE s.document_id = d.id) as signature_count FROM documents d WHERE d.user_id = ? ORDER BY d.created_at DESC`,
      )
      .all(userId);
  } else {
    rows = d
      .prepare(
        `SELECT d.id, d.user_id, d.title, d.filename, d.file_path, d.slug, d.status, d.collect_email, d.settings, d.created_at, d.updated_at, (SELECT COUNT(*) FROM signatures s WHERE s.document_id = d.id) as signature_count FROM documents d ORDER BY d.created_at DESC`,
      )
      .all();
  }
  return rows.map((r) => ({
    ...r,
    collect_email: !!r.collect_email,
    settings: r.settings ? JSON.parse(r.settings) : {},
  }));
}

export async function getDocument(id) {
  const d = getDb();
  const doc = d
    .prepare(
      `SELECT id, user_id, title, filename, file_path, slug, status, collect_email, settings, created_at, updated_at FROM documents WHERE id = ?`,
    )
    .get(id);
  if (!doc) return null;
  const fields = d.prepare(`SELECT * FROM document_fields WHERE document_id = ? ORDER BY sort_order`).all(id);
  return { ...doc, collect_email: !!doc.collect_email, settings: doc.settings ? JSON.parse(doc.settings) : {}, fields };
}

export async function getDocumentBySlug(slug) {
  const d = getDb();
  const doc = d
    .prepare(
      `SELECT id, user_id, title, filename, file_path, slug, status, collect_email, settings, created_at, updated_at FROM documents WHERE slug = ?`,
    )
    .get(slug);
  if (!doc) return null;
  const fields = d.prepare(`SELECT * FROM document_fields WHERE document_id = ? ORDER BY sort_order`).all(doc.id);
  return { ...doc, collect_email: !!doc.collect_email, settings: doc.settings ? JSON.parse(doc.settings) : {}, fields };
}

export async function getDocumentFile(id) {
  const d = getDb();
  const row = d.prepare(`SELECT file_data, filename FROM documents WHERE id = ?`).get(id);
  if (!row) return null;
  return { data: row.file_data, filename: row.filename };
}

export async function updateDocument(id, updates) {
  const now = new Date().toISOString();
  const d = getDb();
  const fieldKeys = Object.keys(updates).filter((k) => k !== 'fields');
  if (fieldKeys.length === 0) return;
  const setClauses = fieldKeys.map((k) => {
    const col = k.replace(/([A-Z])/g, '_$1').toLowerCase();
    return `${col} = ?`;
  });
  const values = fieldKeys.map((k) => {
    if (k === 'file_data') return updates[k] || null;
    if (typeof updates[k] === 'object') return JSON.stringify(updates[k]);
    return updates[k];
  });
  values.push(id);
  d.prepare(`UPDATE documents SET ${setClauses.join(', ')}, updated_at = ? WHERE id = ?`).run(...values, now);
}

export async function deleteDocument(id) {
  const d = getDb();
  d.prepare(`DELETE FROM documents WHERE id = ?`).run(id);
}

export async function saveDocumentFields(documentId, fields) {
  const d = getDb();
  d.prepare(`DELETE FROM document_fields WHERE document_id = ?`).run(documentId);
  const stmt = d.prepare(
    `INSERT INTO document_fields (id, document_id, label, field_type, x, y, width, height, font_size, date_format, required, page_number, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    stmt.run(
      uuidv4(),
      documentId,
      f.label,
      f.fieldType || f.field_type,
      f.x,
      f.y,
      f.width,
      f.height,
      f.font_size || f.fontSize || null,
      f.date_format || null,
      f.required !== false ? 1 : 0,
      f.page_number || 0,
      i,
    );
  }
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
  const d = getDb();
  const now = new Date().toISOString();
  const info = d
    .prepare(
      `INSERT INTO signatures (document_id, field_values, signer_email, created_at, ip_address, ipv4, ipv6, ip_location) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      documentId || null,
      JSON.stringify(fieldValues || {}),
      signerEmail || null,
      now,
      ipAddress,
      ipv4 || null,
      ipv6 || null,
      ipLocation || null,
    );
  return info.lastInsertRowid;
}

export async function getSignatures(documentId) {
  const d = getDb();
  let rows;
  if (documentId) {
    rows = d.prepare(`SELECT * FROM signatures WHERE document_id = ? ORDER BY created_at DESC`).all(documentId);
  } else {
    rows = d.prepare(`SELECT * FROM signatures ORDER BY created_at DESC`).all();
  }
  return rows.map((r) => ({ ...r, field_values: r.field_values ? JSON.parse(r.field_values) : {} }));
}

export async function getSignature(id) {
  const d = getDb();
  const row = d.prepare(`SELECT * FROM signatures WHERE id = ?`).get(Number(id) || id);
  if (!row) return null;
  return { ...row, field_values: row.field_values ? JSON.parse(row.field_values) : {} };
}

export async function updateSignature(id, { fieldValues } = {}) {
  if (!fieldValues) return;
  const d = getDb();
  d.prepare(`UPDATE signatures SET field_values = ? WHERE id = ?`).run(JSON.stringify(fieldValues), Number(id) || id);
}

export async function deleteSignature(id) {
  const d = getDb();
  const info = d.prepare(`DELETE FROM signatures WHERE id = ?`).run(Number(id) || id);
  if (info.changes === 0) throw new Error('Not found');
}
