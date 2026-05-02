// Public portfolio projects API
const { getPool } = require('./_db');
const { mapProjectRow } = require('./_urls');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const dbPool = getPool();
    const slug = req.query?.slug;
    const id = req.query?.id;

    if (id) {
      const result = await dbPool.query(
        'SELECT * FROM projects WHERE id = $1 AND published = true',
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      return res.status(200).json(mapProjectRow(result.rows[0]));
    }

    if (slug) {
      const result = await dbPool.query(
        'SELECT * FROM projects WHERE slug = $1 AND published = true',
        [slug]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      return res.status(200).json(mapProjectRow(result.rows[0]));
    }

    const result = await dbPool.query(
      `SELECT * FROM projects WHERE published = true
       ORDER BY sort_order ASC NULLS LAST, created_at DESC`
    );

    return res.status(200).json({ projects: result.rows.map(mapProjectRow) });
  } catch (error) {
    console.error('projects API error:', error);
    return res.status(500).json({ error: 'Internal server error', projects: [] });
  }
};
