import sql from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

export default requireAuth(async function handler(req, res) {
  const rid = req.restaurante.id;
  const { id } = req.query;

  if (req.method === 'DELETE') {
    await sql`DELETE FROM productos WHERE id = ${id} AND restaurante_id = ${rid}`;
    return res.json({ ok: true });
  }

  if (req.method === 'PUT') {
    const { nombre, unidad, merma, notas } = req.body;
    const rows = await sql`
      UPDATE productos SET nombre=${nombre}, unidad=${unidad}, merma=${merma}, notas=${notas||null}
      WHERE id=${id} AND restaurante_id=${rid} RETURNING *`;
    return res.json(rows[0]);
  }

  res.status(405).end();
});
