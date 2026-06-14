import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

export function getRestauranteFromReq(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  return verifyToken(token);
}

export function requireAuth(handler) {
  return async (req, res) => {
    const user = getRestauranteFromReq(req);
    if (!user) return res.status(401).json({ error: 'No autorizado' });
    req.restaurante = user;
    return handler(req, res);
  };
}
