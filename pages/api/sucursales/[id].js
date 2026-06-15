import sql from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';
import bcrypt from 'bcryptjs';

export default requireAuth(async function handler(req, res) {
  if (!req.restaurante?.esSuperadmin) return res.status(403).json({ error: 'Solo superadmin' });
  const { id } = req.query;

  if (req.method === 'PUT') {
    const { nombre, username, password } = req.body;
    if (!nombre || !username) return res.status(400).json({ error: 'Faltan datos' });
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await sql`UPDATE restaurantes SET nombre=${nombre}, username=${username.toLowerCase()} , password_hash=${hash} WHERE id=${id}`;
    } else {
      await sql`UPDATE restaurantes SET nombre=${nombre}, username=${username.toLowerCase()} WHERE id=${id}`;
    }
    return res.json({ ok: true });
  }

  res.status(405).end();
});
