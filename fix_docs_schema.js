import { createPool } from '@vercel/postgres';

const pool = createPool({ connectionString: process.env.POSTGRES_URL });
const client = await pool.connect();
try {
  const tables = ['users', 'sessions', 'documents', 'document_permissions', 'document_fields', 'signatures'];
  for (const table of tables) {
    const { rows: cols } = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns 
       WHERE table_name = $1 ORDER BY ordinal_position`, [table]
    );
    console.log(`${table}: ${cols.map(c => `${c.column_name} (${c.data_type})`).join(', ')}`);
    console.log('');
  }
} catch (e) {
  console.error('Error:', e.message);
} finally {
  client.release();
}
