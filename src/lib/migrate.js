import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), '.data');

const MIGRATIONS = {
  'documents.json': (doc) => {
    let changed = false;
    if (doc.settings === undefined) {
      doc.settings = {};
      changed = true;
    }
    if (doc.collect_email === undefined) {
      doc.collect_email = false;
      changed = true;
    }
    if (doc.fields === undefined) {
      doc.fields = [];
      changed = true;
    }
    if (doc.status === undefined) {
      doc.status = 'draft';
      changed = true;
    }
    if (doc.file_data === undefined) {
      delete doc.file_data;
      changed = true;
    }
    return changed;
  },
  'users.json': (user) => {
    let changed = false;
    if (user.name === undefined) {
      user.name = null;
      changed = true;
    }
    if (user.role === undefined) {
      user.role = 'user';
      changed = true;
    }
    if (user.created_at === undefined) {
      user.created_at = new Date().toISOString();
      changed = true;
    }
    return changed;
  },
  'sessions.json': (session) => {
    let changed = false;
    if (session.userId !== undefined && session.user_id === undefined) {
      session.user_id = session.userId;
      changed = true;
    }
    if (session.user_id === undefined) {
      session.user_id = null;
      changed = true;
    }
    if (session.created_at === undefined) {
      session.created_at = new Date().toISOString();
      changed = true;
    }
    return changed;
  },
  'signatures.json': (sig) => {
    let changed = false;
    if (sig.signer_email === undefined) {
      sig.signer_email = null;
      changed = true;
    }
    if (sig.ipv4 === undefined) {
      sig.ipv4 = null;
      changed = true;
    }
    if (sig.ipv6 === undefined) {
      sig.ipv6 = null;
      changed = true;
    }
    if (sig.ip_location === undefined) {
      sig.ip_location = null;
      changed = true;
    }
    if (sig.field_values === undefined || typeof sig.field_values === 'string') {
      sig.field_values = typeof sig.field_values === 'string' ? JSON.parse(sig.field_values) : {};
      changed = true;
    }
    return changed;
  },
  'permissions.json': (perm) => {
    let changed = false;
    if (perm.email === undefined) {
      perm.email = null;
      changed = true;
    }
    if (perm.permission === undefined) {
      perm.permission = 'view';
      changed = true;
    }
    return changed;
  },
};

export async function migrateJSON() {
  let migrated = false;
  for (const [file, fn] of Object.entries(MIGRATIONS)) {
    const fp = path.join(DATA_DIR, file);
    try {
      await fs.access(fp);
    } catch {
      continue;
    }
    const raw = await fs.readFile(fp, 'utf-8');
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!Array.isArray(data)) continue;
    let fileChanged = false;
    for (let i = 0; i < data.length; i++) {
      if (fn(data[i])) fileChanged = true;
    }
    if (fileChanged) {
      await fs.writeFile(fp, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`Migrated ${file}`);
      migrated = true;
    }
  }
  return migrated;
}

export async function migrateJSONtoDB() {
  const { getEngine } = await import('./drivers/engine.js');
  const engine = getEngine();
  if (engine === 'json') return;

  // Run schema migration first
  await migrateJSON();

  const baseDir = DATA_DIR;
  const driverPath = `./drivers/${engine}.js`;
  const authPath = './drivers/auth.js';

  const { createUser, findUserByEmail } = await import(authPath);
  const driver = await import(driverPath);

  // ── Users ──
  try {
    const raw = await fs.readFile(path.join(baseDir, 'users.json'), 'utf-8');
    const users = JSON.parse(raw);
    if (Array.isArray(users) && users.length > 0) {
      let count = 0;
      for (const u of users) {
        const existing = await findUserByEmail(u.email);
        if (!existing) {
          await createUser({ email: u.email, password: u.password, name: u.name, role: u.role || 'user' });
          count++;
        }
      }
      console.log(`Migrated ${count} users to ${engine}`);
    }
  } catch {}

  // ── Documents ──
  try {
    const raw = await fs.readFile(path.join(baseDir, 'documents.json'), 'utf-8');
    const docs = JSON.parse(raw);
    if (Array.isArray(docs) && docs.length > 0) {
      let count = 0;
      for (const d of docs) {
        const existing = await driver.getDocument(d.id);
        if (existing) {
          await driver.updateDocument(d.id, {
            title: d.title,
            status: d.status,
            collect_email: d.collect_email,
            settings: d.settings || {},
          });
          if (d.fields && d.fields.length > 0) {
            await driver.saveDocumentFields(d.id, d.fields);
          }
        } else {
          const id = d.id;
          await driver.createDocument({
            title: d.title,
            filename: d.filename,
            fileBuffer: null,
            userId: d.user_id,
          });
          // updateDocument doesn't allow setting created_at, but we can try other fields
          await driver.updateDocument(id, {
            title: d.title,
            status: d.status || 'draft',
            collect_email: d.collect_email ?? false,
            slug: d.slug,
            settings: d.settings || {},
          });
          if (d.fields && d.fields.length > 0) {
            await driver.saveDocumentFields(id, d.fields);
          }
        }
        count++;
      }
      console.log(`Migrated ${count} documents to ${engine}`);
    }
  } catch {}

  // ── Signatures ──
  try {
    const raw = await fs.readFile(path.join(baseDir, 'signatures.json'), 'utf-8');
    const sigs = JSON.parse(raw);
    if (Array.isArray(sigs) && sigs.length > 0) {
      let count = 0;
      for (const s of sigs) {
        await driver.insertSignature({
          documentId: s.document_id,
          fieldValues: typeof s.field_values === 'string' ? JSON.parse(s.field_values) : s.field_values || {},
          signerEmail: s.signer_email,
          ipAddress: s.ip_address,
          ipv4: s.ipv4,
          ipv6: s.ipv6,
          ipLocation: s.ip_location,
        });
        count++;
      }
      console.log(`Migrated ${count} signatures to ${engine}`);
    }
  } catch {}

  // Backup old JSON files
  const backupDir = path.join(baseDir, `backup-${Date.now()}`);
  await fs.mkdir(backupDir, { recursive: true });
  const files = ['users.json', 'sessions.json', 'documents.json', 'signatures.json', 'permissions.json'];
  for (const file of files) {
    const fp = path.join(baseDir, file);
    try {
      await fs.access(fp);
      await fs.copyFile(fp, path.join(backupDir, file));
    } catch {}
  }
  console.log(`JSON data backed up to ${backupDir}`);
}
