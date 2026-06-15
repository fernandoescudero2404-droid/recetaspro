import sql from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

export const config = { api: { bodyParser: { sizeLimit: '5mb' } } };

export default requireAuth(async function handler(req, res) {
  const rid = req.restaurante.id;

  if (req.method === 'GET') {
    const rows = await sql`SELECT branding FROM restaurantes WHERE id = ${rid}`;
    return res.json(rows[0]?.branding || null);
  }

  if (req.method === 'PUT') {
    const branding = req.body;
    await sql`UPDATE restaurantes SET branding = ${JSON.stringify(branding)} WHERE id = ${rid}`;
    return res.json({ ok: true });
  }

  res.status(405).end();
});
