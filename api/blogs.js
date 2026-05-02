// Vercel Serverless Function - Get all blogs or single blog
const { Pool } = require('pg');
const { mapBlogRow } = require('./_urls');

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

        return res.status(200).json(mapBlogRow(result.rows[0]));
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

        return res.status(200).json(mapBlogRow(result.rows[0]));
      }

      // List published blogs with optional category + search (q)
      const page = parseInt(req.query?.page, 10) || 1;
      const limit = Math.min(parseInt(req.query?.limit, 10) || 10, 50);
      const category = req.query?.category ? String(req.query.category).trim() : '';
      const qRaw = req.query?.q;
      const q = qRaw != null && String(qRaw).trim() ? String(qRaw).trim() : '';
      const offset = (page - 1) * limit;

      const conditions = ['published = true'];
      const filterParams = [];

      if (category) {
        filterParams.push(category);
        conditions.push(`category = $${filterParams.length}`);
      }

      if (q) {
        filterParams.push('%' + q + '%');
        const idx = filterParams.length;
        conditions.push(
          `(title ILIKE $${idx} OR excerpt ILIKE $${idx} OR content ILIKE $${idx})`
        );
      }

      const whereClause = 'WHERE ' + conditions.join(' AND ');

      const countResult = await dbPool.query(
        `SELECT COUNT(*) FROM blogs ${whereClause}`,
        filterParams
      );
      const total = parseInt(countResult.rows[0].count, 10);

      const listParams = [...filterParams, limit, offset];
      const limIdx = filterParams.length + 1;
      const offIdx = filterParams.length + 2;

      const result = await dbPool.query(
        `SELECT * FROM blogs ${whereClause} ORDER BY created_at DESC LIMIT $${limIdx} OFFSET $${offIdx}`,
        listParams
      );

      const catsResult = await dbPool.query(
        `SELECT DISTINCT category FROM blogs
         WHERE published = true AND category IS NOT NULL AND TRIM(category) <> ''
         ORDER BY category ASC`
      );
      const categories = catsResult.rows.map((r) => r.category).filter(Boolean);

      return res.status(200).json({
        blogs: result.rows.map((row) => mapBlogRow(row)),
        categories,
        pagination: {
          page,
          limit,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / limit)
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
