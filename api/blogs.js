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
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const dbPool = getPool();
    
    if (req.method === 'GET') {
      // Handle query parameters - Vercel passes them in req.query
      const id = req.query?.id;
      const slug = req.query?.slug;

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
      const page = parseInt(req.query?.page) || 1;
      const limit = parseInt(req.query?.limit) || 10;
      const category = req.query?.category;
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
      const total = parseInt(countResult.rows[0].count);

      return res.status(200).json({
        blogs: result.rows,
        pagination: {
          page: page,
          limit: limit,
          total: total,
          totalPages: Math.ceil(total / limit)
        }
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Database error:', error);
    // Return error in a format that won't break the frontend
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      blogs: [] // Ensure blogs array exists even on error
    });
  }
}
