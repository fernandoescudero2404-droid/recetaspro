import sql from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

// Expande ingredientes recursivamente soportando: producto, intermedia, final
async function expandirIngredientes(ingredientes, productos, intermedias, finales, visited = new Set()) {
  const resultado = {};

  for (const ing of ingredientes) {
    const tipo = ing.tipo;
    const refId = ing.ref_id;
    const factor = parseFloat(ing.cantidad) || 1;

    if (tipo === 'producto') {
      const prod = productos.find(p => p.id === refId);
      if (!prod) continue;
      const qty = factor;
      const merma = parseFloat(prod.merma) || 0;
      const bruto = qty / ((100 - merma) / 100);
      const key = `prod_${prod.id}`;
      if (!resultado[key]) resultado[key] = { nombre: prod.nombre, unidad: prod.unidad, cantidad: 0, bruto: 0, merma };
      resultado[key].cantidad += qty;
      resultado[key].bruto += bruto;

    } else if (tipo === 'intermedia') {
      if (visited.has(`i_${refId}`)) continue;
      const receta = intermedias.find(r => r.id === refId);
      if (!receta) continue;
      const newVisited = new Set(visited);
      newVisited.add(`i_${refId}`);
      const sub = await expandirIngredientes(receta.ingredientes || [], productos, intermedias, finales, newVisited);
      for (const [k, v] of Object.entries(sub)) {
        if (!resultado[k]) resultado[k] = { ...v, cantidad: 0, bruto: 0 };
        resultado[k].cantidad += v.cantidad * factor;
        resultado[k].bruto += v.bruto * factor;
      }

    } else if (tipo === 'final') {
      if (visited.has(`f_${refId}`)) continue;
      const plato = finales.find(f => f.id === refId);
      if (!plato) continue;
      const newVisited = new Set(visited);
      newVisited.add(`f_${refId}`);
      const sub = await expandirIngredientes(plato.ingredientes || [], productos, intermedias, finales, newVisited);
      for (const [k, v] of Object.entries(sub)) {
        if (!resultado[k]) resultado[k] = { ...v, cantidad: 0, bruto: 0 };
        resultado[k].cantidad += v.cantidad * factor;
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
  if (!desde || !hasta) return res.status(400).json({ error: 'Faltan fechas desde/hasta' });

  const [ventas, productos, intermediasRaw, finalesRaw] = await Promise.all([
    sql`SELECT * FROM ventas WHERE restaurante_id=${rid} AND fecha BETWEEN ${desde} AND ${hasta}`,
    sql`SELECT * FROM productos WHERE restaurante_id=${rid}`,
    sql`SELECT * FROM recetas_intermedias WHERE restaurante_id=${rid}`,
    sql`SELECT * FROM recetas_finales WHERE restaurante_id=${rid}`,
  ]);

  if (!ventas.length) return res.json({ ventas: [], consumo: [], porPlato: [] });

  const idsInt = intermediasRaw.map(r => r.id);
  const idsFin = finalesRaw.map(r => r.id);

  const [ingsInt, ingsFin] = await Promise.all([
    idsInt.length ? sql`SELECT * FROM ingredientes_intermedias WHERE receta_id = ANY(${idsInt})` : [],
    idsFin.length ? sql`SELECT * FROM ingredientes_finales WHERE receta_id = ANY(${idsFin})` : [],
  ]);

  const intermedias = intermediasRaw.map(r => ({ ...r, ingredientes: ingsInt.filter(i => i.receta_id === r.id) }));
  const finales = finalesRaw.map(r => ({ ...r, ingredientes: ingsFin.filter(i => i.receta_id === r.id) }));

  const porPlato = {};
  for (const v of ventas) {
    if (!porPlato[v.receta_final_id]) porPlato[v.receta_final_id] = { nombre: v.receta_nombre, cantidad: 0 };
    porPlato[v.receta_final_id].cantidad += parseInt(v.cantidad);
  }

  const consumoTotal = {};
  for (const [pid, info] of Object.entries(porPlato)) {
    const plato = finales.find(f => f.id === parseInt(pid));
    if (!plato) continue;
    const ing = await expandirIngredientes(plato.ingredientes, productos, intermedias, finales);
    for (const [k, v] of Object.entries(ing)) {
      if (!consumoTotal[k]) consumoTotal[k] = { ...v, cantidad: 0, bruto: 0 };
      consumoTotal[k].cantidad += v.cantidad * info.cantidad;
      consumoTotal[k].bruto += v.bruto * info.cantidad;
    }
  }

  res.json({
    ventas,
    porPlato: Object.values(porPlato).sort((a, b) => b.cantidad - a.cantidad),
    consumo: Object.values(consumoTotal).sort((a, b) => b.bruto - a.bruto),
  });
});
