import sql from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';
import bcrypt from 'bcryptjs';

export default requireAuth(async function handler(req, res) {
  if (!req.restaurante?.esSuperadmin) return res.status(403).json({ error: 'Solo superadmin' });

  if (req.method === 'GET') {
    const rows = await sql`SELECT id, nombre, username, created_at FROM restaurantes ORDER BY nombre`;
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { nombre, username, password } = req.body;
    if (!nombre || !username || !password) return res.status(400).json({ error: 'Faltan datos' });
    const exists = await sql`SELECT id FROM restaurantes WHERE username = ${username.toLowerCase().trim()} LIMIT 1`;
    if (exists.length) return res.status(409).json({ error: 'Ya existe una sucursal con ese usuario' });
    const hash = await bcrypt.hash(password, 10);
    const rows = await sql`
      INSERT INTO restaurantes (nombre, username, password_hash)
      VALUES (${nombre.trim()}, ${username.toLowerCase().trim()}, ${hash})
      RETURNING id, nombre, username`;
    return res.status(201).json(rows[0]);
  }

  res.status(405).end();
});
