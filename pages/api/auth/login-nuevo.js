import sql from '../../../lib/db';
import bcrypt from 'bcryptjs';
import { signToken } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Faltan datos' });

  const users = await sql`SELECT * FROM usuarios WHERE email = ${email.toLowerCase().trim()} LIMIT 1`;
  if (!users.length) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  const user = users[0];

  if (!user.activo) return res.status(403).json({ error: 'Tu cuenta está pendiente de aprobación' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Email o contraseña incorrectos' });

  if (user.es_superadmin) {
    // Superadmin: obtener todas las sucursales
    const sucursales = await sql`SELECT id, nombre, username FROM restaurantes ORDER BY nombre`;
    const token = signToken({ userId: user.id, nombre: user.nombre, email: user.email, esSuperadmin: true });
    return res.json({ token, usuario: { id: user.id, nombre: user.nombre, email: user.email, esSuperadmin: true }, sucursales, modulos: 'all' });
  }

  // Usuario normal: obtener sus sucursales y permisos
  const permisos = await sql`
    SELECT up.restaurante_id, up.modulos, r.nombre as restaurante_nombre, r.username
    FROM usuario_permisos up
    JOIN restaurantes r ON r.id = up.restaurante_id
    WHERE up.usuario_id = ${user.id}
    ORDER BY r.nombre`;

  if (!permisos.length) return res.status(403).json({ error: 'No tenés sucursales asignadas. Contactá al administrador.' });

  const token = signToken({ userId: user.id, nombre: user.nombre, email: user.email, esSuperadmin: false });
  return res.json({
    token,
    usuario: { id: user.id, nombre: user.nombre, email: user.email, esSuperadmin: false },
    sucursales: permisos.map(p => ({ id: p.restaurante_id, nombre: p.restaurante_nombre, username: p.username, modulos: p.modulos })),
  });
}
