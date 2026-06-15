import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
  try { return jwt.verify(token, SECRET); } catch { return null; }
}

export function getAuthFromReq(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7));
}

export function requireAuth(handler) {
  return async (req, res) => {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ error: 'No autorizado' });

    // Support both old format (id = restauranteId) and new format (userId + restauranteId)
    if (decoded.userId) {
      // New format: userId in token, restauranteId in header
      const restauranteId = req.headers['x-restaurante-id'];
      req.restaurante = {
        ...decoded,
        id: restauranteId ? parseInt(restauranteId) : null,
      };
    } else {
      // Old format: id = restauranteId directly
      req.restaurante = { id: decoded.id, nombre: decoded.nombre, username: decoded.username };
    }

    return handler(req, res);
  };
}
