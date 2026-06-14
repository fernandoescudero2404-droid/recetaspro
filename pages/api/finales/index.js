import sql from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

export default requireAuth(async function handler(req, res) {
  const rid = req.restaurante.id;

  if (req.method === 'GET') {
    const recetas = await sql`SELECT * FROM recetas_finales WHERE restaurante_id = ${rid} ORDER BY nombre`;
    const ingredientes = recetas.length
      ? await sql`SELECT * FROM ingredientes_finales WHERE receta_id = ANY(${recetas.map(r=>r.id)})`
      : [];
    return res.json(recetas.map(r => ({
      ...r,
      ingredientes: ingredientes.filter(i => i.receta_id === r.id)
    })));
  }

  if (req.method === 'POST') {
    const { nombre, ingredientes } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });

    const rows = await sql`
      INSERT INTO recetas_finales (restaurante_id, nombre)
      VALUES (${rid}, ${nombre}) RETURNING *`;
    const receta = rows[0];

    if (ingredientes && ingredientes.length) {
      for (const ing of ingredientes) {
        await sql`INSERT INTO ingredientes_finales (receta_id, tipo, ref_id, cantidad, unidad)
          VALUES (${receta.id}, ${ing.tipo}, ${ing.ref_id}, ${ing.cantidad||0}, ${ing.unidad||'kg'})`;
      }
    }

    const ings = await sql`SELECT * FROM ingredientes_finales WHERE receta_id = ${receta.id}`;
    return res.status(201).json({ ...receta, ingredientes: ings });
  }

  res.status(405).end();
});
