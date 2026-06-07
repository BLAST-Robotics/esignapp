export function getPostgresUrl() {
  return (
    process.env.POSTGRES_URL ||
    process.env.STORAGE_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL_UNPOOLED ||
    process.env.NEON_DATABASE_URL ||
    process.env.PRISMA_POSTGRES_URL
  );
}

export function isPostgres() {
  const url = getPostgresUrl();
  return !!url && url !== 'postgres://placeholder:placeholder@localhost:5432/placeholder';
}

export function isSqlite() {
  return process.env.STORAGE_ENGINE === 'sqlite';
}

export function getEngine() {
  if (process.env.STORAGE_ENGINE === 'sqlite') return 'sqlite';
  if (process.env.STORAGE_ENGINE === 'postgres') return 'postgres';
  if (process.env.STORAGE_ENGINE === 'json') return 'json';
  if (isPostgres()) return 'postgres';
  return 'json';
}
