import sql from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

export default requireAuth(async function handler(req, res) {
  const rid = req.restaurante.id;

  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM productos WHERE restaurante_id = ${rid} ORDER BY nombre`;
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { nombre, unidad, merma, notas } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    const rows = await sql`
      INSERT INTO productos (restaurante_id, nombre, unidad, merma, notas)
      VALUES (${rid}, ${nombre}, ${unidad||'kg'}, ${merma||0}, ${notas||null})
      RETURNING *`;
    return res.status(201).json(rows[0]);
  }

  res.status(405).end();
});
