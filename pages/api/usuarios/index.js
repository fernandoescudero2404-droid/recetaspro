import sql from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

export default requireAuth(async function handler(req, res) {
  if (!req.restaurante?.esSuperadmin) return res.status(403).json({ error: 'Solo superadmin' });

  if (req.method === 'GET') {
    const usuarios = await sql`
      SELECT u.id, u.nombre, u.email, u.activo, u.es_superadmin, u.created_at,
        COALESCE(
          json_agg(json_build_object('restaurante_id', up.restaurante_id, 'restaurante_nombre', r.nombre, 'modulos', up.modulos))
          FILTER (WHERE up.id IS NOT NULL), '[]'
        ) as permisos
      FROM usuarios u
      LEFT JOIN usuario_permisos up ON up.usuario_id = u.id
      LEFT JOIN restaurantes r ON r.id = up.restaurante_id
      GROUP BY u.id ORDER BY u.created_at DESC`;
    return res.json(usuarios);
  }
  res.status(405).end();
});
