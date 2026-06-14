// node lib/db-migrate.js
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('Migrando base de datos...');

  await sql`ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS stock_token TEXT UNIQUE`;
  await sql`ALTER TABLE productos    ADD COLUMN IF NOT EXISTS stock_publico       BOOLEAN        DEFAULT false`;
  await sql`ALTER TABLE productos    ADD COLUMN IF NOT EXISTS factor_conversion   NUMERIC(10,6)  DEFAULT 1.0`;
  await sql`ALTER TABLE productos    ADD COLUMN IF NOT EXISTS producto_base_id    INTEGER REFERENCES productos(id)`;
  await sql`ALTER TABLE stocks       ADD COLUMN IF NOT EXISTS notas               TEXT`;
  // Columna para habilitar intermedias en el link público
  await sql`ALTER TABLE recetas_intermedias ADD COLUMN IF NOT EXISTS stock_publico_intermedia BOOLEAN DEFAULT false`;
  // Tabla de entregas semanales
  await sql`CREATE TABLE IF NOT EXISTS entregas (
    id              SERIAL PRIMARY KEY,
    restaurante_id  INTEGER REFERENCES restaurantes(id) ON DELETE CASCADE,
    fecha           DATE NOT NULL,
    producto_id     INTEGER REFERENCES productos(id) ON DELETE SET NULL,
    producto_nombre TEXT NOT NULL,
    unidad          TEXT NOT NULL,
    cantidad        NUMERIC(10,3) NOT NULL DEFAULT 0,
    notas           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`;

  console.log('✓ Migración completada');
  process.exit(0);
}
migrate().catch(e => { console.error('Error:', e.message); process.exit(1); });
