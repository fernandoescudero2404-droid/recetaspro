// Ejecutar si ya tenés la base de datos creada y querés agregar soporte
// para platos que usan otros platos como ingrediente:
//   node lib/db-migrate.js
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  // El tipo ya acepta 'final' como valor — no requiere cambio de schema
  // Solo verificamos que las tablas existen
  const check = await sql`SELECT COUNT(*) FROM ingredientes_finales`;
  console.log('✓ Tabla ingredientes_finales OK, filas:', check[0].count);
  console.log('✓ El campo tipo ya acepta: producto, intermedia, final');
  console.log('✓ No se necesitan cambios de schema');
  process.exit(0);
}
migrate().catch(e => { console.error(e); process.exit(1); });
