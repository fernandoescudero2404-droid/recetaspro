import sql from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

export default requireAuth(async function handler(req, res) {
  const rid = req.restaurante.id;

  if (req.method === 'GET') {
    const { desde, hasta } = req.query;
    let rows;
    if (desde && hasta) {
      rows = await sql`SELECT * FROM entregas WHERE restaurante_id=${rid} AND fecha BETWEEN ${desde} AND ${hasta} ORDER BY fecha DESC`;
    } else {
      rows = await sql`SELECT * FROM entregas WHERE restaurante_id=${rid} ORDER BY fecha DESC LIMIT 100`;
    }
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { fecha, producto_id, producto_nombre, unidad, cantidad, notas } = req.body;
    if (!fecha || !producto_id) return res.status(400).json({ error: 'Faltan datos' });
    const rows = await sql`
      INSERT INTO entregas (restaurante_id, fecha, producto_id, producto_nombre, unidad, cantidad, notas)
      VALUES (${rid}, ${fecha}, ${producto_id}, ${producto_nombre}, ${unidad}, ${cantidad||0}, ${notas||null})
      RETURNING *`;
    return res.status(201).json(rows[0]);
  }

  res.status(405).end();
});
