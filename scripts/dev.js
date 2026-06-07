import { spawn, exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (a) => {
      rl.close();
      resolve(a.trim());
    }),
  );
}

function openTerminal(cmd, title) {
  const plat = os.platform();
  if (plat === 'win32') {
    const wt = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps', 'wt.exe');
    if (fs.existsSync(wt)) {
      spawn('wt', ['-w', '0', 'nt', '--title', title, cmd], { shell: true, detached: true }).unref();
    } else {
      spawn('start', ['cmd', '/c', title, '&&', cmd], { shell: true, detached: true }).unref();
    }
  } else if (plat === 'darwin') {
    spawn('osascript', ['-e', `tell app "Terminal" to do script "${cmd}"`], { detached: true }).unref();
  } else {
    const terms = ['x-terminal-emulator', 'gnome-terminal', 'xterm', 'konsole'];
    for (const t of terms) {
      try {
        exec(`which ${t} 2>/dev/null`, (_err, stdout) => {
          if (stdout.trim()) {
            spawn(t, ['-e', cmd], { detached: true }).unref();
          }
        });
      } catch {}
    }
  }
}

async function main() {
  const args = process.argv.slice(2);

  let flag = null;
  let pgUrl = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') flag = 'json';
    else if (args[i] === '--sqlite') flag = 'sqlite';
    else if (args[i] === '--postgres') {
      flag = 'postgres';
      pgUrl = args[i + 1];
      if (pgUrl && !pgUrl.startsWith('--')) i++;
      else pgUrl = null;
    }
  }

  const envPath = path.join(__dirname, '..', '.env.local');
  const currentEnv = {};
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
      if (m) currentEnv[m[1].trim()] = m[2].trim();
    }
  }

  let engine = flag || currentEnv.STORAGE_ENGINE || null;
  let needsSave = false;

  if (!engine) {
    console.log('\nNo storage engine configured. Choose one:');
    console.log('  1) JSON files (simple, no DB needed)');
    console.log('  2) SQLite (fast, local file-based DB)');
    console.log('  3) Postgres (remote DB, enter URL)');
    const choice = (await ask('Enter 1, 2, or 3 [1]: ')) || '1';
    if (choice === '2') engine = 'sqlite';
    else if (choice === '3') {
      engine = 'postgres';
      if (!pgUrl) pgUrl = await ask('Enter Postgres URL: ');
    } else engine = 'json';
    needsSave = true;
  }

  if (flag === 'postgres' && !pgUrl && !currentEnv.POSTGRES_URL && !currentEnv.STORAGE_URL) {
    pgUrl = await ask('Enter Postgres connection URL: ');
    needsSave = true;
  }

  if (needsSave || flag) {
    const lines = [];
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
        if (
          !line.startsWith('STORAGE_ENGINE=') &&
          !line.startsWith('POSTGRES_URL=') &&
          !line.startsWith('STORAGE_URL=')
        )
          lines.push(line);
      }
    }
    lines.push(`STORAGE_ENGINE=${engine}`);
    if (engine === 'postgres' && pgUrl) lines.push(`POSTGRES_URL=${pgUrl}`);
    fs.writeFileSync(envPath, `${lines.filter(Boolean).join('\n')}\n`);
  }

  process.env.STORAGE_ENGINE = engine;
  if (pgUrl) process.env.POSTGRES_URL = pgUrl;

  // ─── Auto-migrate from JSON if switching engines ──
  const dataDir = path.join(__dirname, '..', '.data');
  const hasJSON =
    fs.existsSync(path.join(dataDir, 'documents.json')) || fs.existsSync(path.join(dataDir, 'users.json'));

  if (hasJSON && engine !== 'json') {
    const oldEngine = currentEnv.STORAGE_ENGINE || 'json';
    if (oldEngine === 'json') {
      const doMigrate = (await ask(`Existing JSON data found. Migrate to ${engine}? [Y/n]: `)) || 'y';
      if (doMigrate.toLowerCase() === 'y') {
        console.log('Migrating JSON data...');
        try {
          const { migrateJSONtoDB } = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'lib', 'migrate.js')).href);
          await migrateJSONtoDB();
          console.log('Migration complete.');
        } catch (e) {
          console.error('Migration failed:', e.message);
        }
      }
    }
  }

  const _cwd = process.cwd();
  const divider = '─'.repeat(Math.min(process.stdout.columns || 60, 60));

  console.log(`\n  ${divider}`);
  console.log(`  KeySign Dev  │  engine: ${engine}  │  port: 80`);
  console.log(`  ${divider}\n`);

  // ─── Dev server (foreground) ─────────────────────
  const dev = spawn('bun', ['run', 'next', 'dev', '--port', '80'], {
    env: { ...process.env },
    shell: true,
    stdio: 'inherit',
  });

  // ─── Database REPL (separate terminal) ────────────
  let dbCmd = null;
  if (engine === 'sqlite') {
    const dbPath = path.join(__dirname, '..', '.data', 'esign.db');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    dbCmd = `sqlite3 "${dbPath}"`;
    console.log(`  → Opening SQLite REPL in new terminal...`);
  } else if (engine === 'postgres') {
    const url = pgUrl || process.env.POSTGRES_URL;
    if (url) {
      dbCmd = `psql "${url}"`;
      console.log(`  → Opening psql in new terminal...`);
    }
  }

  if (dbCmd) {
    openTerminal(dbCmd, `KeySign DB (${engine})`);
  } else {
    if (engine === 'json') console.log(`  JSON mode: files in .data/`);
    else console.log(`  Install sqlite3 or psql CLI for REPL`);
  }

  console.log(`\n  ${divider}`);
  console.log(`  Dev server running in this terminal.`);
  console.log(`  DB REPL opened in a separate window.`);
  console.log(`  Press Ctrl+C to stop everything.\n`);

  dev.on('exit', (code) => process.exit(code));
}

process.on('SIGINT', () => process.exit());
main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
