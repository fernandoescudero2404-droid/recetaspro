// Ejecutar UNA SOLA VEZ para crear las tablas:
//   node lib/db-init.js
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');

const sql = neon(process.env.DATABASE_URL);

async function init() {
  console.log('Creando tablas...');

  await sql`CREATE TABLE IF NOT EXISTS restaurantes (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    restaurante_id INTEGER REFERENCES restaurantes(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    unidad TEXT NOT NULL DEFAULT 'kg',
    merma NUMERIC(5,2) NOT NULL DEFAULT 0,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS recetas_intermedias (
    id SERIAL PRIMARY KEY,
    restaurante_id INTEGER REFERENCES restaurantes(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    rinde TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS ingredientes_intermedias (
    id SERIAL PRIMARY KEY,
    receta_id INTEGER REFERENCES recetas_intermedias(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    ref_id INTEGER NOT NULL,
    cantidad NUMERIC(10,3) NOT NULL DEFAULT 0,
    unidad TEXT NOT NULL DEFAULT 'kg'
  )`;

  await sql`CREATE TABLE IF NOT EXISTS recetas_finales (
    id SERIAL PRIMARY KEY,
    restaurante_id INTEGER REFERENCES restaurantes(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS ingredientes_finales (
    id SERIAL PRIMARY KEY,
    receta_id INTEGER REFERENCES recetas_finales(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    ref_id INTEGER NOT NULL,
    cantidad NUMERIC(10,3) NOT NULL DEFAULT 0,
    unidad TEXT NOT NULL DEFAULT 'kg'
  )`;

  await sql`CREATE TABLE IF NOT EXISTS ventas (
    id SERIAL PRIMARY KEY,
    restaurante_id INTEGER REFERENCES restaurantes(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    receta_final_id INTEGER REFERENCES recetas_finales(id) ON DELETE SET NULL,
    receta_nombre TEXT NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS stocks (
    id SERIAL PRIMARY KEY,
    restaurante_id INTEGER REFERENCES restaurantes(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
    producto_nombre TEXT NOT NULL,
    unidad TEXT NOT NULL,
    cantidad NUMERIC(10,3) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  console.log('✓ Tablas creadas');

  const hash1 = await bcrypt.hash('admin123', 10);
  const hash2 = await bcrypt.hash('sushi123', 10);

  await sql`INSERT INTO restaurantes (nombre, username, password_hash)
    VALUES ('Restaurante Central', 'admin', ${hash1})
    ON CONFLICT (username) DO NOTHING`;

  await sql`INSERT INTO restaurantes (nombre, username, password_hash)
    VALUES ('Sushi House', 'sushi', ${hash2})
    ON CONFLICT (username) DO NOTHING`;

  console.log('✓ Usuarios demo: admin/admin123 y sushi/sushi123');
  console.log('✓ Init completado!');
  process.exit(0);
}

init().catch(e => { console.error('Error:', e.message); process.exit(1); });
