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

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const rid = req.restaurante.id;
  const { desde, hasta } = req.query;
  if (!desde || !hasta) return res.status(400).json({ error: 'Faltan fechas' });

  const [ventas, productos, intermediasRaw, finalesRaw, stocks, entregas] = await Promise.all([
    sql`SELECT * FROM ventas    WHERE restaurante_id=${rid} AND fecha BETWEEN ${desde} AND ${hasta}`,
    sql`SELECT * FROM productos WHERE restaurante_id=${rid}`,
    sql`SELECT * FROM recetas_intermedias WHERE restaurante_id=${rid}`,
    sql`SELECT * FROM recetas_finales     WHERE restaurante_id=${rid}`,
    sql`SELECT * FROM stocks   WHERE restaurante_id=${rid} AND fecha BETWEEN ${desde} AND ${hasta}`,
    sql`SELECT * FROM entregas WHERE restaurante_id=${rid} AND fecha BETWEEN ${desde} AND ${hasta}`,
  ]);

  // También buscamos stocks de la semana ANTERIOR (STK INI = último stock antes del período)
  const stocksAntes = await sql`
    SELECT DISTINCT ON (producto_id) *
    FROM stocks
    WHERE restaurante_id=${rid} AND fecha < ${desde}
    ORDER BY producto_id, fecha DESC`;

  // STK FINAL = último stock dentro del período
  const stocksFinal = await sql`
    SELECT DISTINCT ON (producto_id) *
    FROM stocks
    WHERE restaurante_id=${rid} AND fecha BETWEEN ${desde} AND ${hasta}
    ORDER BY producto_id, fecha DESC`;

  if (!ventas.length) return res.json({ ventas: [], consumo: [], porPlato: [], tablaComparativa: [] });

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

  // Calcular consumo teórico total por producto
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

  // Armar tabla comparativa por producto
  const tablaComparativa = Object.values(consumoTotal).map(c => {
    const stkIniRow  = stocksAntes.find(s => s.producto_id === c.id);
    const stkFinRow  = stocksFinal.find(s => s.producto_id === c.id);
    const entregasP  = entregas.filter(e => e.producto_id === c.id);

    const stkIni   = parseFloat(stkIniRow?.cantidad)  || 0;
    const stkFinal = parseFloat(stkFinRow?.cantidad)  || 0;
    const entrega  = entregasP.reduce((a, e) => a + parseFloat(e.cantidad), 0);
    const consTeo  = c.bruto; // consumo teórico bruto (ya incluye merma)
    // Consumo real = lo que realmente desapareció del stock
    const consReal = stkIni + entrega - stkFinal;
    const desvio   = consTeo > 0 ? ((consReal - consTeo) / consTeo) * 100 : 0;

    return {
      id:       c.id,
      nombre:   c.nombre,
      unidad:   c.unidad,
      merma:    c.merma,
      stkIni,
      entrega,
      consTeo:  Math.round(consTeo * 1000) / 1000,
      stkFinal,
      consReal: Math.round(consReal * 1000) / 1000,
      desvio:   Math.round(desvio * 10) / 10,
      tieneDatos: stkIniRow !== undefined || stkFinRow !== undefined || entregasP.length > 0,
    };
  }).sort((a, b) => b.consTeo - a.consTeo);

  res.json({
    ventas,
    porPlato: Object.values(porPlato).sort((a, b) => b.cantidad - a.cantidad),
    consumo:  Object.values(consumoTotal).sort((a, b) => b.bruto - a.bruto).map(v => ({ ...v, cantidad: v.neto })),
    tablaComparativa,
  });
});
