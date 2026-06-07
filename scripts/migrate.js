import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const q = (prompt) => new Promise((r) => rl.question(prompt, r));

async function readJSON(file) {
  try {
    await fs.promises.access(file);
    return JSON.parse(await fs.promises.readFile(file, 'utf-8'));
  } catch {
    return [];
  }
}

async function main() {
  console.log('\n=== KeySign Data Migration Tool ===\n');

  const ENGINES = ['json', 'sqlite', 'postgres'];
  const from = (await q(`Migrate FROM (${ENGINES.join('/')}): `)).trim().toLowerCase();
  if (!ENGINES.includes(from)) {
    console.log(`Invalid: choose ${ENGINES.join(', ')}`);
    process.exit(1);
  }

  const to = (await q(`Migrate TO (${ENGINES.filter((e) => e !== from).join('/')}): `)).trim().toLowerCase();
  if (!ENGINES.includes(to) || to === from) {
    console.log(`Invalid: must differ from ${from}`);
    process.exit(1);
  }

  const ok = await q(`\nCopy ALL data from ${from} to ${to}? Source data will NOT be deleted. (y/N): `);
  if (ok.toLowerCase() !== 'y') {
    console.log('Cancelled.');
    process.exit(0);
  }

  const DATA_DIR = path.join(__dirname, '..', '.data');

  // ── Step 1: Read all data from source ──
  console.log(`\nReading data from ${from}...`);
  let users = [],
    sessions = [],
    permissions = [],
    documents = [],
    signatures = [];

  if (from === 'json') {
    users = await readJSON(path.join(DATA_DIR, 'users.json'));
    sessions = await readJSON(path.join(DATA_DIR, 'sessions.json'));
    permissions = await readJSON(path.join(DATA_DIR, 'permissions.json'));
    documents = await readJSON(path.join(DATA_DIR, 'documents.json'));
    signatures = await readJSON(path.join(DATA_DIR, 'signatures.json'));
  } else if (from === 'sqlite') {
    const { default: Database } = await import('better-sqlite3');
    const dbPath = path.join(DATA_DIR, 'esign.db');
    if (!fs.existsSync(dbPath)) {
      console.log(`esign.db not found at ${dbPath}`);
      process.exit(1);
    }
    const db = new Database(dbPath);
    try {
      users = db.prepare('SELECT * FROM users').all();
      sessions = db.prepare('SELECT * FROM sessions').all();
      permissions = db.prepare('SELECT * FROM document_permissions').all();
      documents = db.prepare('SELECT * FROM documents').all();
      signatures = db.prepare('SELECT * FROM signatures').all();
      for (const doc of documents) {
        doc.fields = db.prepare('SELECT * FROM document_fields WHERE document_id = ? ORDER BY sort_order').all(doc.id);
      }
    } finally {
      db.close();
    }
  } else if (from === 'postgres') {
    const { createPool } = await import('@vercel/postgres');
    const enginePath = path.join(__dirname, '..', 'src', 'lib', 'drivers', 'engine.js');
    const { getPostgresUrl } = await import(pathToFileURL(enginePath).href);
    const pool = createPool({ connectionString: getPostgresUrl() });
    const client = await pool.connect();
    try {
      const r = (sql) => client.query(sql).then((r) => r.rows);
      users = await r('SELECT * FROM users');
      sessions = await r('SELECT * FROM sessions');
      permissions = await r('SELECT * FROM document_permissions');
      documents = await r(
        'SELECT id, user_id, title, filename, file_path, slug, status, collect_email, settings, created_at, updated_at FROM documents',
      );
      signatures = await r('SELECT * FROM signatures');
      for (const doc of documents) {
        doc.fields = await r(`SELECT * FROM document_fields WHERE document_id = '${doc.id}' ORDER BY sort_order`);
        doc.collect_email = !!doc.collect_email;
        doc.settings = typeof doc.settings === 'string' ? JSON.parse(doc.settings) : doc.settings || {};
      }
    } finally {
      client.release();
    }
  }
  console.log(
    `  Users: ${users.length}, Sessions: ${sessions.length}, Permissions: ${permissions.length}, Docs: ${documents.length}, Sigs: ${signatures.length}`,
  );

  // ── Step 2: Write to destination ──
  console.log(`\nWriting data to ${to}...`);
  process.env.STORAGE_ENGINE = to;

  const authPath = path.join(__dirname, '..', 'src', 'lib', 'drivers', 'auth.js');
  const storePath = path.join(__dirname, '..', 'src', 'lib', 'drivers', `${to}.js`);
  const auth = await import(pathToFileURL(authPath).href);
  const store = await import(pathToFileURL(storePath).href);

  // Users
  let count = 0;
  for (const u of users) {
    const existing = await auth.findUserByEmail(u.email);
    if (!existing) {
      await auth.createUser({ email: u.email, password: u.password, name: u.name, role: u.role || 'user' });
      count++;
    }
  }
  console.log(`  Users: ${count} created, ${users.length - count} skipped`);

  // Sessions
  count = 0;
  for (const s of sessions) {
    const existing = await auth.getSession(s.token);
    if (!existing) {
      await auth.createSession({
        userId: s.user_id || s.userId,
        token: s.token,
        expiresAt: s.expires_at || s.expiresAt,
      });
      count++;
    }
  }
  console.log(`  Sessions: ${count} created`);

  // Permissions
  count = 0;
  for (const p of permissions) {
    await auth.grantPermission({
      documentId: p.document_id || p.documentId,
      userId: p.user_id || p.userId,
      email: p.email,
      permission: p.permission || 'view',
    });
    count++;
  }
  console.log(`  Permissions: ${count} created`);

  // Documents (with fields + file data)
  count = 0;
  for (const doc of documents) {
    const existing = await store.getDocument(doc.id);
    if (existing) continue;

    // Fetch file_data from source if available
    let fileBuffer = null;
    if (from === 'sqlite') {
      const { default: Database } = await import('better-sqlite3');
      const sdb = new Database(path.join(DATA_DIR, 'esign.db'));
      try {
        const r = sdb.prepare('SELECT file_data FROM documents WHERE id = ?').get(doc.id);
        fileBuffer = r?.file_data || null;
      } finally {
        sdb.close();
      }
    } else if (from === 'postgres') {
      const { createPool } = await import('@vercel/postgres');
      const enginePath = path.join(__dirname, '..', 'src', 'lib', 'drivers', 'engine.js');
      const { getPostgresUrl } = await import(pathToFileURL(enginePath).href);
      const pool = createPool({ connectionString: getPostgresUrl() });
      const client = await pool.connect();
      try {
        const r = await client.query(`SELECT file_data FROM documents WHERE id = '${doc.id}'`);
        fileBuffer = r.rows[0]?.file_data || null;
      } finally {
        client.release();
      }
    }

    const newId = await store.createDocument({
      title: doc.title,
      filename: doc.filename,
      fileBuffer,
      userId: doc.user_id,
    });
    await store.updateDocument(newId, {
      title: doc.title,
      status: doc.status || 'draft',
      collect_email: doc.collect_email ?? false,
      slug: doc.slug,
      settings: doc.settings || {},
      file_data: fileBuffer,
    });
    if (doc.fields && doc.fields.length > 0) {
      await store.saveDocumentFields(newId, doc.fields);
    }
    count++;
  }
  console.log(`  Documents: ${count} created, ${documents.length - count} skipped`);

  // Signatures
  count = 0;
  for (const s of signatures) {
    await store.insertSignature({
      documentId: s.document_id || s.documentId,
      fieldValues: typeof s.field_values === 'string' ? JSON.parse(s.field_values) : s.field_values || {},
      signerEmail: s.signer_email || s.signerEmail,
      ipAddress: s.ip_address || s.ipAddress,
      ipv4: s.ipv4,
      ipv6: s.ipv6,
      ipLocation: s.ip_location || s.ipLocation,
    });
    count++;
  }
  console.log(`  Signatures: ${count} created`);

  console.log('\n✓ Migration complete!');
  rl.close();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
