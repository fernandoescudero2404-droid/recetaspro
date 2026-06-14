import sql from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

export default requireAuth(async function handler(req, res) {
  const rid = req.restaurante.id;

  if (req.method === 'GET') {
    const { desde, hasta } = req.query;
    let rows;
    if (desde && hasta) {
      rows = await sql`SELECT * FROM ventas WHERE restaurante_id = ${rid} AND fecha BETWEEN ${desde} AND ${hasta} ORDER BY fecha DESC`;
    } else {
      rows = await sql`SELECT * FROM ventas WHERE restaurante_id = ${rid} ORDER BY fecha DESC LIMIT 100`;
    }
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { fecha, receta_final_id, receta_nombre, cantidad } = req.body;
    if (!fecha || !receta_final_id) return res.status(400).json({ error: 'Faltan datos' });
    const rows = await sql`
      INSERT INTO ventas (restaurante_id, fecha, receta_final_id, receta_nombre, cantidad)
      VALUES (${rid}, ${fecha}, ${receta_final_id}, ${receta_nombre}, ${cantidad||1})
      RETURNING *`;
    return res.status(201).json(rows[0]);
  }

  res.status(405).end();
});
