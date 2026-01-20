// Vercel Serverless Function - Admin operations (POST, PUT, DELETE)
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

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

// Simple authentication check (you should implement proper auth)
function checkAuth(req) {
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.ADMIN_API_KEY}`;
  // In production, implement proper JWT or session-based auth
  // For now, using a simple API key check
  return authHeader && authHeader === expectedAuth;
}

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Check authentication for admin operations
  if (!checkAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized. Please check your API key.' });
  }

  try {
    const dbPool = getPool();
    
    if (req.method === 'POST') {
      // Create new blog
      const { title, excerpt, content, featured_image_url, author, category, tags, published, meta_description, meta_keywords } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
      }

      const slug = generateSlug(title);
      
      // Check if slug already exists
      const slugCheck = await dbPool.query('SELECT id FROM blogs WHERE slug = $1', [slug]);
      if (slugCheck.rows.length > 0) {
        return res.status(400).json({ error: 'A blog with this title already exists' });
      }

      const result = await dbPool.query(
        `INSERT INTO blogs (title, slug, excerpt, content, featured_image_url, author, category, tags, published, meta_description, meta_keywords)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [title, slug, excerpt || '', content, featured_image_url || null, author || 'Stephen Mulingwa', category || null, tags || [], published !== false, meta_description || null, meta_keywords || null]
      );

      return res.status(201).json(result.rows[0]);
    }

    if (req.method === 'PUT') {
      // Update blog
      const id = req.query?.id;
      const { title, excerpt, content, featured_image_url, author, category, tags, published, meta_description, meta_keywords } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Blog ID is required' });
      }

      let slug = null;
      if (title) {
        slug = generateSlug(title);
        // Check if slug already exists for another blog
        const slugCheck = await dbPool.query('SELECT id FROM blogs WHERE slug = $1 AND id != $2', [slug, id]);
        if (slugCheck.rows.length > 0) {
          return res.status(400).json({ error: 'A blog with this title already exists' });
        }
      }

      const updates = [];
      const values = [];
      let paramCount = 1;

      if (title) {
        updates.push(`title = $${paramCount++}`);
        values.push(title);
        updates.push(`slug = $${paramCount++}`);
        values.push(slug);
      }
      if (excerpt !== undefined) {
        updates.push(`excerpt = $${paramCount++}`);
        values.push(excerpt);
      }
      if (content) {
        updates.push(`content = $${paramCount++}`);
        values.push(content);
      }
      if (featured_image_url !== undefined) {
        updates.push(`featured_image_url = $${paramCount++}`);
        values.push(featured_image_url);
      }
      if (author) {
        updates.push(`author = $${paramCount++}`);
        values.push(author);
      }
      if (category !== undefined) {
        updates.push(`category = $${paramCount++}`);
        values.push(category);
      }
      if (tags !== undefined) {
        updates.push(`tags = $${paramCount++}`);
        values.push(JSON.stringify(tags));
      }
      if (published !== undefined) {
        updates.push(`published = $${paramCount++}`);
        values.push(published);
      }
      if (meta_description !== undefined) {
        updates.push(`meta_description = $${paramCount++}`);
        values.push(meta_description);
      }
      if (meta_keywords !== undefined) {
        updates.push(`meta_keywords = $${paramCount++}`);
        values.push(meta_keywords);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(id);
      const query = `UPDATE blogs SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
      
      const result = await dbPool.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Blog not found' });
      }

      return res.status(200).json(result.rows[0]);
    }

    if (req.method === 'DELETE') {
      // Delete blog
      const id = req.query?.id;

      if (!id) {
        return res.status(400).json({ error: 'Blog ID is required' });
      }

      const result = await dbPool.query('DELETE FROM blogs WHERE id = $1 RETURNING *', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Blog not found' });
      }

      return res.status(200).json({ message: 'Blog deleted successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
