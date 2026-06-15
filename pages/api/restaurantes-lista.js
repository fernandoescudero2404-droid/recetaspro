import sql from '../../lib/db';
import { requireAuth } from '../../lib/auth';

export default requireAuth(async function handler(req, res) {
  if (!req.restaurante?.esSuperadmin) return res.status(403).json({ error: 'Solo superadmin' });
  const rows = await sql`SELECT id, nombre, username FROM restaurantes ORDER BY nombre`;
  return res.json(rows);
});
