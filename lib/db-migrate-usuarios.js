// node lib/db-migrate-usuarios.js
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('Migrando sistema de usuarios y sucursales...');

  // Tabla de usuarios (separada de restaurantes)
  await sql`CREATE TABLE IF NOT EXISTS usuarios (
    id              SERIAL PRIMARY KEY,
    nombre          TEXT NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    es_superadmin   BOOLEAN DEFAULT false,
    activo          BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`;

  // Permisos: qué sucursales y módulos puede ver cada usuario
  await sql`CREATE TABLE IF NOT EXISTS usuario_permisos (
    id              SERIAL PRIMARY KEY,
    usuario_id      INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    restaurante_id  INTEGER REFERENCES restaurantes(id) ON DELETE CASCADE,
    modulos         TEXT[] DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(usuario_id, restaurante_id)
  )`;

  console.log('✓ Tablas creadas');

  // Crear superadmin desde las credenciales del restaurante admin
  const admins = await sql`SELECT * FROM restaurantes WHERE username = 'admin' LIMIT 1`;
  if (admins.length) {
    const hash = await bcrypt.hash('admin123', 10);
    await sql`INSERT INTO usuarios (nombre, email, password_hash, es_superadmin, activo)
      VALUES ('Superadmin', 'admin@aisushi.com', ${hash}, true, true)
      ON CONFLICT (email) DO NOTHING`;
    console.log('✓ Superadmin creado: admin@aisushi.com / admin123');
    console.log('  → Cambiá la contraseña desde el panel de admin');
  }

  console.log('✓ Migración completada');
  process.exit(0);
}
migrate().catch(e => { console.error('Error:', e.message); process.exit(1); });
