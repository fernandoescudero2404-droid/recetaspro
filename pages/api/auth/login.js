import sql from '../../../lib/db';
import bcrypt from 'bcryptjs';
import { signToken } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });

  const rows = await sql`SELECT * FROM restaurantes WHERE username = ${username.toLowerCase().trim()} LIMIT 1`;
  const rest = rows[0];
  if (!rest) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

  const ok = await bcrypt.compare(password, rest.password_hash);
  if (!ok) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

  const token = signToken({ id: rest.id, nombre: rest.nombre, username: rest.username });
  res.json({ token, restaurante: { id: rest.id, nombre: rest.nombre, username: rest.username } });
}
