import { createPool } from '@vercel/postgres';

function getUrl() {
  return process.env.POSTGRES_URL
    || process.env.STORAGE_URL
    || process.env.DATABASE_URL_UNPOOLED
    || process.env.DATABASE_URL
    || process.env.NEON_DATABASE_URL_UNPOOLED
    || process.env.NEON_DATABASE_URL
    || process.env.PRISMA_POSTGRES_URL;
}

let pool;

export function getPool() {
  if (!pool) {
    pool = createPool({
      connectionString: getUrl(),
    });
  }
  return pool;
}

export async function initTable() {
  const client = await getPool().connect();
  try {
    await client.sql`
      CREATE TABLE IF NOT EXISTS signatures (
        id SERIAL PRIMARY KEY,
        child_name VARCHAR(255) NOT NULL,
        parent_name VARCHAR(255) NOT NULL,
        signature_b64 TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        ip_address VARCHAR(45)
      )
    `;
  } finally {
    client.release();
  }
}
