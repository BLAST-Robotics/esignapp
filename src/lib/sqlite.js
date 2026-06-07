import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), '.data');
const DB_PATH = path.join(DATA_DIR, 'esign.db');

let db = null;

export function getDb() {
  if (db) return db;
  const Database = require('better-sqlite3');
  const fs = require('node:fs');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

export function initSqliteTables() {
  const d = getDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
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
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
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
      created_at TEXT DEFAULT (datetime('now')),
      ip_address TEXT,
      ipv4 TEXT,
      ipv6 TEXT,
      ip_location TEXT
    );
    CREATE TABLE IF NOT EXISTS document_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
      user_id TEXT,
      email TEXT,
      permission TEXT DEFAULT 'view',
      UNIQUE(document_id, user_id)
    );
  `);
}

export function isSqlite() {
  return process.env.STORAGE_ENGINE === 'sqlite';
}
