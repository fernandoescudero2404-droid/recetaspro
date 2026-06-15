import sql from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

export default requireAuth(async function handler(req, res) {
  if (!req.restaurante?.esSuperadmin) return res.status(403).json({ error: 'Solo superadmin' });
  const { id } = req.query;

  if (req.method === 'PUT') {
    const { activo, permisos } = req.body;
    // Update activo status
    if (activo !== undefined) {
      await sql`UPDATE usuarios SET activo = ${activo} WHERE id = ${id}`;
    }
    // Update permisos (sucursales + módulos)
    if (permisos) {
      await sql`DELETE FROM usuario_permisos WHERE usuario_id = ${id}`;
      for (const p of permisos) {
        await sql`INSERT INTO usuario_permisos (usuario_id, restaurante_id, modulos)
          VALUES (${id}, ${p.restaurante_id}, ${p.modulos})`;
      }
    }
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM usuarios WHERE id = ${id} AND es_superadmin = false`;
    return res.json({ ok: true });
  }

  res.status(405).end();
});
