import sql from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';
import crypto from 'crypto';

export default requireAuth(async function handler(req, res) {
  const rid = req.restaurante.id;

  if (req.method === 'GET') {
    const rest = await sql`SELECT stock_token FROM restaurantes WHERE id = ${rid}`;

    // Productos brutos habilitados
    const productos = await sql`
      SELECT id, nombre, unidad, merma, notas, stock_publico,
             factor_conversion, producto_base_id
      FROM productos WHERE restaurante_id = ${rid} ORDER BY nombre`;

    // Recetas intermedias con su factor calculado desde ingredientes
    // Factor = suma de kg de cada ingrediente (ya que rinde = 1kg)
    const intermedias = await sql`
      SELECT ri.id, ri.nombre, ri.stock_publico_intermedia,
             COALESCE(
               (SELECT SUM(ii.cantidad)
                FROM ingredientes_intermedias ii
                WHERE ii.receta_id = ri.id AND ii.tipo = 'producto'),
               1.0
             ) AS factor_auto
      FROM recetas_intermedias ri
      WHERE ri.restaurante_id = ${rid}
      ORDER BY ri.nombre`;

    return res.json({ token: rest[0]?.stock_token, productos, intermedias });
  }

  if (req.method === 'POST' && req.body.action === 'generar_token') {
    const token = crypto.randomBytes(16).toString('hex');
    await sql`UPDATE restaurantes SET stock_token = ${token} WHERE id = ${rid}`;
    return res.json({ token });
  }

  if (req.method === 'PUT') {
    const { productos, intermedias } = req.body;

    for (const p of (productos || [])) {
      await sql`UPDATE productos SET
        stock_publico     = ${p.stock_publico},
        factor_conversion = ${p.factor_conversion || 1.0},
        producto_base_id  = ${p.producto_base_id || null}
        WHERE id = ${p.id} AND restaurante_id = ${rid}`;
    }

    for (const r of (intermedias || [])) {
      await sql`UPDATE recetas_intermedias SET
        stock_publico_intermedia = ${r.habilitado}
        WHERE id = ${r.id} AND restaurante_id = ${rid}`;
    }

    return res.json({ ok: true });
  }

  res.status(405).end();
});
