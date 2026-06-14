import sql from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

export default requireAuth(async function handler(req, res) {
  const rid = req.restaurante.id;
  const { id } = req.query;

  if (req.method === 'DELETE') {
    await sql`DELETE FROM recetas_intermedias WHERE id=${id} AND restaurante_id=${rid}`;
    return res.json({ ok: true });
  }

  if (req.method === 'PUT') {
    const { nombre, rinde, ingredientes } = req.body;
    await sql`UPDATE recetas_intermedias SET nombre=${nombre}, rinde=${rinde||null} WHERE id=${id} AND restaurante_id=${rid}`;
    if (ingredientes) {
      await sql`DELETE FROM ingredientes_intermedias WHERE receta_id=${id}`;
      for (const ing of ingredientes) {
        await sql`INSERT INTO ingredientes_intermedias (receta_id, tipo, ref_id, cantidad, unidad)
          VALUES (${id}, ${ing.tipo}, ${ing.ref_id}, ${ing.cantidad||0}, ${ing.unidad||'kg'})`;
      }
    }
    const receta = await sql`SELECT * FROM recetas_intermedias WHERE id=${id}`;
    const ings = await sql`SELECT * FROM ingredientes_intermedias WHERE receta_id=${id}`;
    return res.json({ ...receta[0], ingredientes: ings });
  }

  res.status(405).end();
});
