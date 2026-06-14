// ============================================================
// SCRIPT DE IMPORTACIÓN DE RECETAS DESDE EXCEL
// Ejecutar: node lib/import-recetas.js
// 
// Qué hace:
//   1. Lee el archivo Excel (listado_receta_final.xlsx)
//   2. Crea todos los productos brutos (merma en 0, la editás después)
//   3. Crea todas las recetas intermedias con sus ingredientes
//   4. Crea todos los platos finales con sus ingredientes
//      (incluyendo platos que usan otros platos como ingrediente)
//
// IMPORTANTE: Ejecutar DESPUÉS de npm run db:init
// El restaurante se carga para el usuario que especifiques abajo.
// ============================================================

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const XLSX = require('xlsx');
const path = require('path');

const sql = neon(process.env.DATABASE_URL);

// ── CONFIGURACIÓN ──────────────────────────────────────────
// Cambiá esto por el username del restaurante donde importar
const RESTAURANTE_USERNAME = 'admin';

// Ruta al archivo Excel
const EXCEL_PATH = path.join(__dirname, '..', 'listado_receta_final.xlsx');
// ──────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🍣 Importando recetas para restaurante: ${RESTAURANTE_USERNAME}\n`);

  // Obtener restaurante
  const rests = await sql`SELECT id, nombre FROM restaurantes WHERE username = ${RESTAURANTE_USERNAME}`;
  if (!rests.length) {
    console.error(`❌ No se encontró el restaurante "${RESTAURANTE_USERNAME}". Corré npm run db:init primero.`);
    process.exit(1);
  }
  const rid = rests[0].id;
  console.log(`✓ Restaurante: ${rests[0].nombre} (id=${rid})`);

  // Leer Excel
  let wb;
  try {
    wb = XLSX.readFile(EXCEL_PATH);
  } catch (e) {
    console.error(`❌ No se pudo leer el archivo Excel en: ${EXCEL_PATH}`);
    console.error('   Copiá el archivo "listado_receta_final.xlsx" a la raíz del proyecto.');
    process.exit(1);
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1); // skip header
  console.log(`✓ Excel leído: ${rows.length} filas`);

  // ── CLASIFICAR ─────────────────────────────────────────────
  const platosFinalesNames = new Set(rows.map(r => r[0]).filter(Boolean));
  const origenesNames = new Set(rows.map(r => r[1]).filter(Boolean));
  const insumosNames = new Set(rows.map(r => r[2]).filter(Boolean));

  const intermediasNames = new Set([...origenesNames].filter(x => !platosFinalesNames.has(x)));
  const productosBrutosNames = new Set([...insumosNames].filter(x => !origenesNames.has(x)));
  const platosQuesonOrigen = new Set([...origenesNames].filter(x => platosFinalesNames.has(x)));

  console.log(`\n📦 Productos brutos: ${productosBrutosNames.size}`);
  console.log(`🧪 Recetas intermedias: ${intermediasNames.size}`);
  console.log(`🍽️  Platos finales: ${platosFinalesNames.size}`);
  console.log(`🔗 Platos que son ingrediente de otros: ${platosQuesonOrigen.size}`);

  // Limpiar datos existentes del restaurante (opcional — comentar si no querés borrar)
  console.log('\n🗑️  Limpiando datos anteriores...');
  await sql`DELETE FROM ingredientes_finales WHERE receta_id IN (SELECT id FROM recetas_finales WHERE restaurante_id=${rid})`;
  await sql`DELETE FROM ingredientes_intermedias WHERE receta_id IN (SELECT id FROM recetas_intermedias WHERE restaurante_id=${rid})`;
  await sql`DELETE FROM recetas_finales WHERE restaurante_id=${rid}`;
  await sql`DELETE FROM recetas_intermedias WHERE restaurante_id=${rid}`;
  await sql`DELETE FROM productos WHERE restaurante_id=${rid}`;
  console.log('✓ Limpieza lista');

  // ── 1. CREAR PRODUCTOS BRUTOS ─────────────────────────────
  console.log('\n📦 Creando productos brutos...');
  const prodMap = {}; // nombre → id

  // Unidades más comunes por nombre
  const unidadPorNombre = (nombre) => {
    const n = nombre.toLowerCase();
    if (n.includes('lts') || n.includes('litro') || n.includes('sifon')) return 'litro';
    if (n.includes('und') || n.includes('unid') || n.includes('x100') || n.includes('maple') ||
        n.includes('caja') || n.includes('bolsa') || n.includes('bandeja') || n.includes('pote') ||
        n.includes('palito') || n.includes('manga') || n.includes('blister')) return 'unidad';
    return 'kg';
  };

  for (const nombre of [...productosBrutosNames].sort()) {
    const unidad = unidadPorNombre(nombre);
    const rows2 = await sql`
      INSERT INTO productos (restaurante_id, nombre, unidad, merma, notas)
      VALUES (${rid}, ${nombre}, ${unidad}, 0, 'Importado - completar merma')
      RETURNING id`;
    prodMap[nombre] = rows2[0].id;
  }
  console.log(`✓ ${Object.keys(prodMap).length} productos creados`);

  // ── 2. CREAR RECETAS INTERMEDIAS ──────────────────────────
  console.log('\n🧪 Creando recetas intermedias...');
  const intermMap = {}; // nombre → id

  // Agrupar ingredientes por intermedia
  const intermIngredientes = {};
  for (const row of rows) {
    const [plato, origen, insumo, cant, unidad] = row;
    if (origen && intermediasNames.has(origen)) {
      if (!intermIngredientes[origen]) intermIngredientes[origen] = [];
      // Verificar si no está duplicado
      const exists = intermIngredientes[origen].some(i => i.insumo === insumo);
      if (!exists) {
        intermIngredientes[origen].push({ insumo, cant: parseFloat(cant) || 0, unidad: unidad || 'kg' });
      }
    }
  }

  for (const nombre of [...intermediasNames].sort()) {
    const rows2 = await sql`
      INSERT INTO recetas_intermedias (restaurante_id, nombre, rinde)
      VALUES (${rid}, ${nombre}, null)
      RETURNING id`;
    intermMap[nombre] = rows2[0].id;
  }

  // Insertar ingredientes de intermedias (todos son productos brutos)
  let ingIntCount = 0;
  for (const [nombre, ings] of Object.entries(intermIngredientes)) {
    const recetaId = intermMap[nombre];
    for (const ing of ings) {
      const prodId = prodMap[ing.insumo];
      if (!prodId) continue; // insumo no clasificado como producto bruto (raro)
      await sql`INSERT INTO ingredientes_intermedias (receta_id, tipo, ref_id, cantidad, unidad)
        VALUES (${recetaId}, 'producto', ${prodId}, ${ing.cant}, ${ing.unidad})`;
      ingIntCount++;
    }
  }
  console.log(`✓ ${Object.keys(intermMap).length} intermedias creadas, ${ingIntCount} ingredientes`);

  // ── 3. CREAR PLATOS FINALES ───────────────────────────────
  console.log('\n🍽️  Creando platos finales...');
  const finalMap = {}; // nombre → id

  for (const nombre of [...platosFinalesNames].sort()) {
    const rows2 = await sql`
      INSERT INTO recetas_finales (restaurante_id, nombre)
      VALUES (${rid}, ${nombre})
      RETURNING id`;
    finalMap[nombre] = rows2[0].id;
  }
  console.log(`✓ ${Object.keys(finalMap).length} platos creados`);

  // Agrupar ingredientes por plato (deduplicados por origen)
  // La lógica: cada fila tiene un "origen" (la sub-receta o producto directo)
  // Agrupamos por origen para no duplicar si hay varios insumos del mismo origen
  const platosOrigenYa = {}; // platoNombre → Set de origenes ya procesados

  const ingsFinalPorOrigen = {}; // `platoNombre::origen` → { tipo, ref_id, cantidad, unidad }

  for (const row of rows) {
    const [plato, origen, insumo, cant, unidad] = row;
    if (!plato || !origen) continue;

    const key = `${plato}::${origen}`;

    if (ingsFinalPorOrigen[key]) continue; // ya procesamos este origen para este plato

    // Determinar qué tipo de ingrediente es "origen":
    if (intermediasNames.has(origen)) {
      // Es una receta intermedia pura → tipo intermedia, cantidad=1 porción (o la del primer insumo)
      ingsFinalPorOrigen[key] = { tipo: 'intermedia', ref_id: intermMap[origen], cantidad: 1, unidad: 'porción' };
    } else if (platosFinalesNames.has(origen)) {
      // Es un plato final usado como ingrediente → tipo final
      ingsFinalPorOrigen[key] = { tipo: 'final', ref_id: null, nombre_ref: origen, cantidad: 1, unidad: 'porción' };
    } else if (productosBrutosNames.has(origen)) {
      // El origen mismo es un producto bruto (cuando coincide con insumo)
      ingsFinalPorOrigen[key] = { tipo: 'producto', ref_id: prodMap[origen], cantidad: parseFloat(cant) || 0, unidad: unidad || 'kg' };
    }
  }

  // Resolver ref_id de los platos-como-ingrediente (ahora que finalMap está completo)
  for (const [key, ing] of Object.entries(ingsFinalPorOrigen)) {
    if (ing.tipo === 'final' && ing.nombre_ref) {
      ing.ref_id = finalMap[ing.nombre_ref];
    }
  }

  // Insertar ingredientes de platos finales
  // Necesitamos agregar columna tipo='final' en la tabla si no existe
  // Por ahora: usar tipo='final' donde corresponda
  let ingFinCount = 0;
  for (const [key, ing] of Object.entries(ingsFinalPorOrigen)) {
    const platoNombre = key.split('::')[0];
    const recetaId = finalMap[platoNombre];
    if (!recetaId || !ing.ref_id) continue;

    await sql`INSERT INTO ingredientes_finales (receta_id, tipo, ref_id, cantidad, unidad)
      VALUES (${recetaId}, ${ing.tipo}, ${ing.ref_id}, ${ing.cantidad}, ${ing.unidad})`;
    ingFinCount++;
  }
  console.log(`✓ ${ingFinCount} ingredientes de platos finales insertados`);

  console.log('\n✅ ¡Importación completada!');
  console.log('   - Entrá a la app y revisá los productos brutos para completar las mermas');
  console.log('   - Las recetas intermedias y platos ya están listos para usar\n');
  process.exit(0);
}

main().catch(e => {
  console.error('❌ Error:', e.message);
  console.error(e);
  process.exit(1);
});
