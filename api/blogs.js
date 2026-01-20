// Vercel Serverless Function - Get all blogs or single blog
const { Pool } = require('pg');

let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.NEON_DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }
  return pool;
}

module.exports = async (req, res) => {
  const dbPool = getPool();
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { id, slug } = req.query;

      if (id) {
        // Get single blog by ID
        const result = await dbPool.query(
          'SELECT * FROM blogs WHERE id = $1 AND published = true',
          [id]
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Blog not found' });
        }
        
        return res.status(200).json(result.rows[0]);
      }

      if (slug) {
        // Get single blog by slug
        const result = await dbPool.query(
          'SELECT * FROM blogs WHERE slug = $1 AND published = true',
          [slug]
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Blog not found' });
        }
        
        return res.status(200).json(result.rows[0]);
      }

      // Get all published blogs
      const { page = 1, limit = 10, category } = req.query;
      const offset = (page - 1) * limit;

      let query = 'SELECT * FROM blogs WHERE published = true';
      const params = [];
      
      if (category) {
        query += ' AND category = $1';
        params.push(category);
        query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit, offset);
      } else {
        query += ' ORDER BY created_at DESC LIMIT $1 OFFSET $2';
        params.push(limit, offset);
      }

      const result = await dbPool.query(query, params);
      const countResult = await dbPool.query('SELECT COUNT(*) FROM blogs WHERE published = true');

      return res.status(200).json({
        blogs: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].count),
          totalPages: Math.ceil(countResult.rows[0].count / limit)
        }
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
