// ============================================================
// SCRIPT DE IMPORTACIÓN DEFINITIVO
// node lib/import-recetas.js
//
// Fuentes:
//   - recetas.xlsx              → recetas intermedias (hoja 'recetas')
//   - recetas.xlsx              → platos finales (hoja 'productos finales')
//   - productos_brutos_aisushi.xlsx → productos brutos con SKU y merma
//
// Tipos en hoja 'recetas':
//   MP  = producto bruto
//   SUB = otra receta intermedia
//
// Tipos en hoja 'productos finales':
//   MP  = producto bruto
//   SUB = receta intermedia (con cantidad en kg/und)
//   REC = otro plato final (con cantidad en rolls/porciones)
// ============================================================
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const XLSX = require('xlsx');
const path = require('path');

const sql = neon(process.env.DATABASE_URL);
const RESTAURANTE_USERNAME = process.env.IMPORT_USERNAME || 'admin';

function readSheet(filename, sheetName) {
  const wb = XLSX.readFile(path.join(__dirname, '..', filename));
  const ws = wb.Sheets[sheetName];
  if (!ws) { console.error(`❌ Hoja "${sheetName}" no encontrada en ${filename}`); process.exit(1); }
  return XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1).filter(r => r[0]);
}

function parseMerma(val) {
  if (!val && val !== 0) return 0;
  const s = String(val).replace('%', '').trim();
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return (n > 0 && n < 1) ? Math.round(n * 100 * 100) / 100 : Math.round(n * 100) / 100;
}

async function main() {
  console.log(`\n🍣 Importando para: ${RESTAURANTE_USERNAME}\n`);

  const rests = await sql`SELECT id, nombre FROM restaurantes WHERE username = ${RESTAURANTE_USERNAME}`;
  if (!rests.length) { console.error('❌ Restaurante no encontrado'); process.exit(1); }
  const rid = rests[0].id;
  console.log(`✓ Restaurante: ${rests[0].nombre}`);

  // ── Leer archivos ────────────────────────────────────────
  const rowsProductos  = readSheet('productos_brutos_aisushi.xlsx', 'Hoja1');
  const rowsRecetas    = readSheet('recetas.xlsx', 'recetas');
  const rowsFinales    = readSheet('recetas.xlsx', 'productos finales');
  console.log(`✓ Productos brutos: ${rowsProductos.length} | Recetas intermedias: ${rowsRecetas.length} filas | Platos finales: ${rowsFinales.length} filas`);

  // ── Productos brutos ─────────────────────────────────────
  // SKU -> { nombre, merma, unidad }
  // nombre -> { sku, merma, unidad }
  const prodPorSku    = {};
  const prodPorNombre = {};
  for (const r of rowsProductos) {
    if (!r[1]) continue;
    const sku    = String(r[0] || '').trim();
    const nombre = String(r[1]).trim();
    const merma  = parseMerma(r[2]);
    const unidad = String(r[3] || 'kg').trim();
    prodPorSku[sku]       = { nombre, merma, unidad };
    prodPorNombre[nombre] = { sku, merma, unidad };
  }

  // ── Recetas intermedias agrupadas ────────────────────────
  // nombre -> [{ tipo:'MP'|'SUB', sku, subNombre, ingrediente, cantidad, unidad }]
  const recetasData = {};
  for (const r of rowsRecetas) {
    const nombre     = String(r[0] || '').trim();
    const tipo       = String(r[1] || '').trim().toUpperCase();
    const sku        = String(r[2] || '').trim();
    const subNombre  = String(r[3] || '').trim();
    const ingrediente= String(r[4] || '').trim();
    const cantidad   = parseFloat(r[5]) || 0;
    const unidad     = String(r[6] || 'kg').trim();
    if (!nombre || !tipo) continue;
    if (!recetasData[nombre]) recetasData[nombre] = [];
    recetasData[nombre].push({ tipo, sku, subNombre, ingrediente, cantidad, unidad });
  }

  // ── Platos finales agrupados ─────────────────────────────
  // nombre -> [{ tipo:'MP'|'SUB'|'REC', sku, subNombre, recNombre, ingrediente, cantidad, unidad }]
  const platosData = {};
  for (const r of rowsFinales) {
    const nombre     = String(r[0] || '').trim();
    const tipo       = String(r[2] || '').trim().toUpperCase();
    const sku        = String(r[3] || '').trim();
    const subNombre  = String(r[4] || '').trim();
    const recNombre  = String(r[5] || '').trim();
    const ingrediente= String(r[6] || '').trim();
    const cantidad   = parseFloat(r[7]) || 0;
    const unidad     = String(r[8] || 'kg').trim();
    if (!nombre || !tipo) continue;
    if (!platosData[nombre]) platosData[nombre] = [];
    platosData[nombre].push({ tipo, sku, subNombre, recNombre, ingrediente, cantidad, unidad });
  }

  // ── Recetas faltantes: agregar manualmente ─────────────
  // Pollo Tery = 0.958kg Pollo Cocido + 0.23kg Salsa Teriyaki
  if (!recetasData['Pollo Tery']) {
    recetasData['Pollo Tery'] = [
      { tipo: 'SUB', sku: '', subNombre: 'Pollo Cocido',    ingrediente: 'Pollo Cocido',    cantidad: 0.958, unidad: 'kg' },
      { tipo: 'SUB', sku: '', subNombre: 'Salsa Teriyaki',  ingrediente: 'Salsa Teriyaki',  cantidad: 0.23,  unidad: 'kg' },
    ];
  }

  console.log(`\n📦 Productos brutos: ${Object.keys(prodPorNombre).length}`);
  console.log(`🧪 Recetas intermedias: ${Object.keys(recetasData).length}`);
  console.log(`🍽️  Platos finales: ${Object.keys(platosData).length}`);

  // ── Limpiar datos anteriores ─────────────────────────────
  console.log('\n🗑️  Limpiando datos anteriores...');
  await sql`DELETE FROM ingredientes_finales    WHERE receta_id IN (SELECT id FROM recetas_finales      WHERE restaurante_id=${rid})`;
  await sql`DELETE FROM ingredientes_intermedias WHERE receta_id IN (SELECT id FROM recetas_intermedias WHERE restaurante_id=${rid})`;
  await sql`DELETE FROM recetas_finales          WHERE restaurante_id=${rid}`;
  await sql`DELETE FROM recetas_intermedias      WHERE restaurante_id=${rid}`;
  await sql`DELETE FROM productos                WHERE restaurante_id=${rid}`;
  console.log('✓ Limpieza lista');

  // ── 1. Crear productos brutos ────────────────────────────
  console.log('\n📦 Creando productos brutos...');
  const prodMap = {}; // nombre -> id
  for (const [nombre, info] of Object.entries(prodPorNombre)) {
    const rows = await sql`
      INSERT INTO productos (restaurante_id, nombre, unidad, merma, notas)
      VALUES (${rid}, ${nombre}, ${info.unidad}, ${info.merma}, ${info.sku || null})
      RETURNING id`;
    prodMap[nombre] = rows[0].id;
  }
  console.log(`✓ ${Object.keys(prodMap).length} productos creados`);

  // ── 2. Crear recetas intermedias ─────────────────────────
  console.log('\n🧪 Creando recetas intermedias...');
  const intermMap = {}; // nombre -> id
  for (const nombre of Object.keys(recetasData)) {
    const rows = await sql`
      INSERT INTO recetas_intermedias (restaurante_id, nombre, rinde)
      VALUES (${rid}, ${nombre}, '1 kg') RETURNING id`;
    intermMap[nombre] = rows[0].id;
  }
  console.log(`✓ ${Object.keys(intermMap).length} recetas creadas`);

  // Insertar ingredientes de intermedias
  let ingIntCount = 0;
  let warns = 0;
  for (const [nombre, ings] of Object.entries(recetasData)) {
    const recetaId = intermMap[nombre];
    for (const ing of ings) {
      if (ing.tipo === 'MP') {
        // Buscar por SKU primero, luego por nombre del ingrediente
        const prodNombre = prodPorSku[ing.sku]?.nombre || ing.ingrediente;
        const prodId = prodMap[prodNombre];
        if (!prodId) { console.log(`  ⚠️  MP no encontrado: SKU="${ing.sku}" nombre="${ing.ingrediente}" en "${nombre}"`); warns++; continue; }
        await sql`INSERT INTO ingredientes_intermedias (receta_id, tipo, ref_id, cantidad, unidad)
          VALUES (${recetaId}, 'producto', ${prodId}, ${ing.cantidad}, ${ing.unidad})`;
        ingIntCount++;
      } else if (ing.tipo === 'SUB') {
        const subId = intermMap[ing.subNombre];
        if (!subId) { console.log(`  ⚠️  SUB no encontrado: "${ing.subNombre}" en "${nombre}"`); warns++; continue; }
        await sql`INSERT INTO ingredientes_intermedias (receta_id, tipo, ref_id, cantidad, unidad)
          VALUES (${recetaId}, 'intermedia', ${subId}, ${ing.cantidad}, ${ing.unidad})`;
        ingIntCount++;
      }
    }
  }
  console.log(`✓ ${ingIntCount} ingredientes de intermedias insertados${warns ? ` (${warns} warnings)` : ''}`);

  // ── 3. Crear platos finales ──────────────────────────────
  console.log('\n🍽️  Creando platos finales...');
  const finalMap = {}; // nombre -> id
  for (const nombre of Object.keys(platosData)) {
    const rows = await sql`
      INSERT INTO recetas_finales (restaurante_id, nombre)
      VALUES (${rid}, ${nombre}) RETURNING id`;
    finalMap[nombre] = rows[0].id;
  }
  console.log(`✓ ${Object.keys(finalMap).length} platos creados`);

  // Insertar ingredientes de platos finales
  let ingFinCount = 0;
  warns = 0;
  for (const [nombre, ings] of Object.entries(platosData)) {
    const recetaId = finalMap[nombre];
    for (const ing of ings) {
      if (ing.tipo === 'MP') {
        const prodNombre = prodPorSku[ing.sku]?.nombre || ing.ingrediente;
        const prodId = prodMap[prodNombre];
        if (!prodId) { console.log(`  ⚠️  MP no encontrado: SKU="${ing.sku}" en plato "${nombre}"`); warns++; continue; }
        await sql`INSERT INTO ingredientes_finales (receta_id, tipo, ref_id, cantidad, unidad)
          VALUES (${recetaId}, 'producto', ${prodId}, ${ing.cantidad}, ${ing.unidad})`;
        ingFinCount++;
      } else if (ing.tipo === 'SUB') {
        const subId = intermMap[ing.subNombre];
        if (!subId) { console.log(`  ⚠️  SUB no encontrado: "${ing.subNombre}" en plato "${nombre}"`); warns++; continue; }
        await sql`INSERT INTO ingredientes_finales (receta_id, tipo, ref_id, cantidad, unidad)
          VALUES (${recetaId}, 'intermedia', ${subId}, ${ing.cantidad}, ${ing.unidad})`;
        ingFinCount++;
      } else if (ing.tipo === 'REC') {
        const recId = finalMap[ing.recNombre];
        if (!recId) { console.log(`  ⚠️  REC no encontrado: "${ing.recNombre}" en plato "${nombre}"`); warns++; continue; }
        await sql`INSERT INTO ingredientes_finales (receta_id, tipo, ref_id, cantidad, unidad)
          VALUES (${recetaId}, 'final', ${recId}, ${ing.cantidad}, ${ing.unidad})`;
        ingFinCount++;
      }
    }
  }
  console.log(`✓ ${ingFinCount} ingredientes de platos insertados${warns ? ` (${warns} warnings)` : ''}`);

  console.log('\n✅ ¡Importación completada!\n');
  process.exit(0);
}

main().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
