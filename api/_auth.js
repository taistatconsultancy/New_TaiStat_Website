const jwt = require('jsonwebtoken');

function getJwtSecret() {
  const s = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET;
  if (!s) {
    throw new Error('JWT_SECRET (or ADMIN_JWT_SECRET) must be set for admin authentication');
  }
  return s;
}

function signAdminToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

/**
 * Returns decoded JWT payload { sub, username } or null.
 */
function verifyBearer(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
}

function requireAdmin(req, res) {
  const decoded = verifyBearer(req);
  if (!decoded || !decoded.sub) {
    res.status(401).json({ error: 'Unauthorized. Please sign in.' });
    return null;
  }
  return decoded;
}

module.exports = {
  getJwtSecret,
  signAdminToken,
  verifyBearer,
  requireAdmin
};
