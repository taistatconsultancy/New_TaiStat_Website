// Vercel Serverless Function - Admin blog operations (GET all/drafts, POST, PUT, DELETE)
const { getPool } = require('./_db');
const { requireAdmin } = require('./_auth');

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

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizeTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.filter(Boolean).map(String);
  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const admin = requireAdmin(req, res);
  if (!admin) return;

  try {
    const dbPool = getPool();

    if (req.method === 'GET') {
      const id = req.query?.id;
      if (id) {
        const result = await dbPool.query('SELECT * FROM blogs WHERE id = $1', [id]);
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Blog not found' });
        }
        return res.status(200).json(result.rows[0]);
      }
      const result = await dbPool.query(
        'SELECT * FROM blogs ORDER BY created_at DESC'
      );
      return res.status(200).json({ blogs: result.rows });
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const {
        title,
        excerpt,
        content,
        featured_image_url,
        author,
        category,
        tags,
        published,
        published_at,
        meta_description,
        meta_keywords
      } = body;

      if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
      }

      const slug = generateSlug(title);
      const slugCheck = await dbPool.query('SELECT id FROM blogs WHERE slug = $1', [slug]);
      if (slugCheck.rows.length > 0) {
        return res.status(400).json({ error: 'A blog with this title already exists' });
      }

      const tagArr = normalizeTags(tags);
      const goLiveAt = published_at ? new Date(published_at) : new Date();
      if (Number.isNaN(goLiveAt.getTime())) {
        return res.status(400).json({ error: 'Invalid published_at datetime' });
      }

      const result = await dbPool.query(
        `INSERT INTO blogs (title, slug, excerpt, content, featured_image_url, author, category, tags, published, published_at, meta_description, meta_keywords)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9, $10, $11, $12)
         RETURNING *`,
        [
          title,
          slug,
          excerpt || '',
          content,
          featured_image_url || null,
          author || 'Stephen Mulingwa',
          category || null,
          tagArr,
          published !== false,
          goLiveAt.toISOString(),
          meta_description || null,
          meta_keywords || null
        ]
      );

      return res.status(201).json(result.rows[0]);
    }

    if (req.method === 'PUT') {
      const id = req.query?.id;
      const body = await readJson(req);
      const {
        title,
        excerpt,
        content,
        featured_image_url,
        author,
        category,
        tags,
        published,
        published_at,
        meta_description,
        meta_keywords
      } = body;

      if (!id) {
        return res.status(400).json({ error: 'Blog ID is required' });
      }

      let slug = null;
      if (title) {
        slug = generateSlug(title);
        const slugCheck = await dbPool.query(
          'SELECT id FROM blogs WHERE slug = $1 AND id != $2',
          [slug, id]
        );
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
      if (content !== undefined) {
        updates.push(`content = $${paramCount++}`);
        values.push(content);
      }
      if (featured_image_url !== undefined) {
        updates.push(`featured_image_url = $${paramCount++}`);
        values.push(featured_image_url);
      }
      if (author !== undefined) {
        updates.push(`author = $${paramCount++}`);
        values.push(author);
      }
      if (category !== undefined) {
        updates.push(`category = $${paramCount++}`);
        values.push(category);
      }
      if (tags !== undefined) {
        updates.push(`tags = $${paramCount++}::text[]`);
        values.push(normalizeTags(tags));
      }
      if (published !== undefined) {
        updates.push(`published = $${paramCount++}`);
        values.push(published);
      }
      if (published_at !== undefined) {
        const goLiveAt = published_at ? new Date(published_at) : new Date();
        if (Number.isNaN(goLiveAt.getTime())) {
          return res.status(400).json({ error: 'Invalid published_at datetime' });
        }
        updates.push(`published_at = $${paramCount++}`);
        values.push(goLiveAt.toISOString());
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
};
