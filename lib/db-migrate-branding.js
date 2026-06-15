require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
async function migrate() {
  await sql`ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS branding JSONB`;
  console.log('✓ Columna branding agregada');
  process.exit(0);
}
migrate().catch(e => { console.error(e); process.exit(1); });
