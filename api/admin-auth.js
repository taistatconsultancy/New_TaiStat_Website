const bcrypt = require('bcryptjs');
const { getPool } = require('./_db');
const { signAdminToken, verifyBearer } = require('./_auth');

async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST') {
      const body = await readJson(req);
      const username = (body.username || '').trim();
      const password = body.password || '';
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      const pool = getPool();
      const result = await pool.query(
        'SELECT id, username, email, password_hash, role FROM admin_users WHERE username = $1 OR email = $1 LIMIT 1',
        [username]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];
      const ok = bcrypt.compareSync(password, user.password_hash);
      if (!ok) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      await pool.query('UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

      const token = signAdminToken({
        sub: user.id,
        username: user.username,
        role: user.role || 'admin'
      });

      return res.status(200).json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role || 'admin'
        }
      });
    }

    if (req.method === 'GET') {
      const decoded = verifyBearer(req);
      if (!decoded || !decoded.sub) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const pool = getPool();
      const r = await pool.query(
        'SELECT id, username, email, role, created_at, last_login FROM admin_users WHERE id = $1',
        [decoded.sub]
      );

      if (r.rows.length === 0) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      return res.status(200).json({ user: r.rows[0] });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('admin-auth error:', error);
    if (error.message && error.message.includes('JWT_SECRET')) {
      return res.status(500).json({ error: 'Server misconfiguration: set JWT_SECRET in environment' });
    }
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
