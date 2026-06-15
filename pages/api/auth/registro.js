import sql from '../../../lib/db';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { nombre, email, password } = req.body;
  if (!nombre || !email || !password) return res.status(400).json({ error: 'Faltan datos' });
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  const exists = await sql`SELECT id FROM usuarios WHERE email = ${email.toLowerCase().trim()} LIMIT 1`;
  if (exists.length) return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });

  const hash = await bcrypt.hash(password, 10);
  await sql`INSERT INTO usuarios (nombre, email, password_hash, es_superadmin, activo)
    VALUES (${nombre.trim()}, ${email.toLowerCase().trim()}, ${hash}, false, false)`;

  return res.json({ ok: true, mensaje: 'Cuenta creada. Esperá que el administrador te asigne accesos.' });
}
