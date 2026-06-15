import sql from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

async function expandir(ingredientes, productos, intermedias, finales, visited = new Set()) {
  const resultado = {};
  for (const ing of ingredientes) {
    const factor = parseFloat(ing.cantidad) || 0;
    if (!factor) continue;
    if (ing.tipo === 'producto') {
      const prod = productos.find(p => p.id === ing.ref_id);
      if (!prod) continue;
      const merma = parseFloat(prod.merma) || 0;
      const neto  = factor;
      const bruto = merma < 100 ? neto / ((100 - merma) / 100) : neto;
      const key   = `p_${prod.id}`;
      if (!resultado[key]) resultado[key] = { id: prod.id, nombre: prod.nombre, unidad: prod.unidad, merma, neto: 0, bruto: 0 };
      resultado[key].neto  += neto;
      resultado[key].bruto += bruto;
    } else if (ing.tipo === 'intermedia') {
      if (visited.has(`i_${ing.ref_id}`)) continue;
      const receta = intermedias.find(r => r.id === ing.ref_id);
      if (!receta) continue;
      const sub = await expandir(receta.ingredientes || [], productos, intermedias, finales, new Set([...visited, `i_${ing.ref_id}`]));
      for (const [k, v] of Object.entries(sub)) {
        if (!resultado[k]) resultado[k] = { ...v, neto: 0, bruto: 0 };
        resultado[k].neto  += v.neto  * factor;
        resultado[k].bruto += v.bruto * factor;
      }
    } else if (ing.tipo === 'final') {
      if (visited.has(`f_${ing.ref_id}`)) continue;
      const plato = finales.find(f => f.id === ing.ref_id);
      if (!plato) continue;
      const sub = await expandir(plato.ingredientes || [], productos, intermedias, finales, new Set([...visited, `f_${ing.ref_id}`]));
      for (const [k, v] of Object.entries(sub)) {
        if (!resultado[k]) resultado[k] = { ...v, neto: 0, bruto: 0 };
        resultado[k].neto  += v.neto  * factor;
        resultado[k].bruto += v.bruto * factor;
      }
    }
  }
  return resultado;
}

// Dado un lunes de referencia, busca el stock más cercano en rango ±1 día (dom, lun, mar)
// Retorna el stock de ese rango más cercano al lunes
async function getStockCercano(rid, lunesFecha, productos) {
  const lunes = new Date(lunesFecha);
  const domingo = new Date(lunes); domingo.setDate(lunes.getDate() - 1);
  const martes  = new Date(lunes); martes.setDate(lunes.getDate() + 1);

  const domStr = domingo.toISOString().split('T')[0];
  const lunStr = lunesFecha;
  const marStr = martes.toISOString().split('T')[0];

  // Buscar stocks en el rango dom-mar, tomar el más cercano al lunes (prioridad: lun > dom > mar)
  const rows = await sql`
    SELECT DISTINCT ON (producto_id) *
    FROM stocks
    WHERE restaurante_id = ${rid}
      AND fecha IN (${domStr}, ${lunStr}, ${marStr})
      AND (notas IS NULL OR notas NOT LIKE 'Stock receta intermedia%')
    ORDER BY producto_id,
      CASE fecha
        WHEN ${lunStr} THEN 1
        WHEN ${domStr} THEN 2
        WHEN ${marStr} THEN 3
      END`;

  // Indexar por producto_id
  const map = {};
  for (const r of rows) {
    map[r.producto_id] = parseFloat(r.cantidad);
  }
  return map;
}

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const rid = req.restaurante.id;
  const { desde, hasta } = req.query;
  if (!desde || !hasta) return res.status(400).json({ error: 'Faltan fechas' });

  // Calcular el lunes siguiente al período
  const lunesSiguiente = new Date(hasta);
  lunesSiguiente.setDate(lunesSiguiente.getDate() + 1);
  const lunesSigStr = lunesSiguiente.toISOString().split('T')[0];

  const [ventas, productos, intermediasRaw, finalesRaw, entregas] = await Promise.all([
    sql`SELECT * FROM ventas WHERE restaurante_id=${rid} AND fecha BETWEEN ${desde} AND ${hasta}`,
    sql`SELECT * FROM productos WHERE restaurante_id=${rid}`,
    sql`SELECT * FROM recetas_intermedias WHERE restaurante_id=${rid}`,
    sql`SELECT * FROM recetas_finales WHERE restaurante_id=${rid}`,
    sql`SELECT * FROM entregas WHERE restaurante_id=${rid} AND fecha BETWEEN ${desde} AND ${hasta}`,
  ]);

  // Stock inicial: ±1 día del lunes de inicio
  const stkIniMap = await getStockCercano(rid, desde, productos);
  // Stock final real: ±1 día del lunes siguiente
  const stkFinMap = await getStockCercano(rid, lunesSigStr, productos);

  if (!ventas.length && !Object.keys(stkIniMap).length) {
    return res.json({ ventas: [], consumo: [], porPlato: [], tablaComparativa: [] });
  }

  const idsInt = intermediasRaw.map(r => r.id);
  const idsFin = finalesRaw.map(r => r.id);
  const [ingsInt, ingsFin] = await Promise.all([
    idsInt.length ? sql`SELECT * FROM ingredientes_intermedias WHERE receta_id = ANY(${idsInt})` : [],
    idsFin.length ? sql`SELECT * FROM ingredientes_finales     WHERE receta_id = ANY(${idsFin})` : [],
  ]);

  const intermedias = intermediasRaw.map(r => ({ ...r, ingredientes: ingsInt.filter(i => i.receta_id === r.id) }));
  const finales     = finalesRaw.map(r => ({ ...r, ingredientes: ingsFin.filter(i => i.receta_id === r.id) }));

  // Agrupar ventas por plato
  const porPlato = {};
  for (const v of ventas) {
    if (!porPlato[v.receta_final_id]) porPlato[v.receta_final_id] = { nombre: v.receta_nombre, cantidad: 0 };
    porPlato[v.receta_final_id].cantidad += parseInt(v.cantidad);
  }

  // Calcular consumo teórico total
  const consumoTotal = {};
  for (const [pid, info] of Object.entries(porPlato)) {
    const plato = finales.find(f => f.id === parseInt(pid));
    if (!plato) continue;
    const sub = await expandir(plato.ingredientes, productos, intermedias, finales);
    for (const [k, v] of Object.entries(sub)) {
      if (!consumoTotal[k]) consumoTotal[k] = { ...v, neto: 0, bruto: 0 };
      consumoTotal[k].neto  += v.neto  * info.cantidad;
      consumoTotal[k].bruto += v.bruto * info.cantidad;
    }
  }

  // Armar tabla comparativa
  // Incluir todos los productos que tienen algún dato (consumo, stock ini, o stock fin)
  const todosProductos = new Set([
    ...Object.keys(consumoTotal).map(k => k.replace('p_', '')),
    ...Object.keys(stkIniMap),
    ...Object.keys(stkFinMap),
  ]);

  const tablaComparativa = [...todosProductos].map(prodIdStr => {
    const prodId = parseInt(prodIdStr);
    const prod = productos.find(p => p.id === prodId);
    if (!prod) return null;

    const key = `p_${prodId}`;
    const consTeo  = consumoTotal[key]?.bruto || 0;
    const stkIni   = stkIniMap[prodId] ?? null;  // null = no hay dato
    const stkFin   = stkFinMap[prodId] ?? null;  // null = no hay dato

    // Entregas de este producto en el período
    const entregaP = entregas
      .filter(e => e.producto_id === prodId)
      .reduce((a, e) => a + parseFloat(e.cantidad), 0);

    // STK FINAL TEÓRICO = STK INICIAL + ENTREGA - CONS. TEÓRICO
    const stkFinTeo = stkIni !== null ? stkIni + entregaP - consTeo : null;

    // DIFERENCIA = STK FINAL REAL - STK FINAL TEÓRICO
    const diferencia = (stkFin !== null && stkFinTeo !== null)
      ? stkFin - stkFinTeo
      : null;

    // % DIFERENCIA = (STK Final Teórico - STK Final Real) / STK Final Teórico × 100
    const desvio = (diferencia !== null && stkFinTeo !== null && stkFinTeo !== 0)
      ? ((stkFinTeo - (stkFin||0)) / stkFinTeo) * 100
      : null;

    return {
      id:        prodId,
      nombre:    prod.nombre,
      unidad:    prod.unidad,
      consTeo:   Math.round(consTeo * 1000) / 1000,
      stkIni,
      entrega:   entregaP,
      stkFinTeo: stkFinTeo !== null ? Math.round(stkFinTeo * 1000) / 1000 : null,
      stkFin,
      diferencia: diferencia !== null ? Math.round(diferencia * 1000) / 1000 : null,
      desvio:     desvio !== null ? Math.round(desvio * 10) / 10 : null,
      tieneDatos: stkIni !== null || stkFin !== null || entregaP > 0,
    };
  }).filter(Boolean).sort((a, b) => b.consTeo - a.consTeo);

  res.json({
    ventas,
    porPlato: Object.values(porPlato).sort((a, b) => b.cantidad - a.cantidad),
    consumo:  Object.values(consumoTotal).sort((a, b) => b.bruto - a.bruto).map(v => ({ ...v, cantidad: v.neto })),
    tablaComparativa,
    lunesSiguiente: lunesSigStr,
  });
});
