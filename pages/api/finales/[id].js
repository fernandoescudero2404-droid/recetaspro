import sql from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

export default requireAuth(async function handler(req, res) {
  const rid = req.restaurante.id;
  const { id } = req.query;

  if (req.method === 'DELETE') {
    await sql`DELETE FROM recetas_finales WHERE id = ${id} AND restaurante_id = ${rid}`;
    return res.json({ ok: true });
  }

  res.status(405).end();
});
