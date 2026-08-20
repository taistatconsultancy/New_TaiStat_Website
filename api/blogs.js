// Public blogs API — Supabase Postgres
const { getPool } = require('./_db');
const { mapBlogRow } = require('./_urls');

/** Live on site: published flag + published_at not in the future */
const LIVE_CLAUSE = `published = true AND (published_at IS NULL OR published_at <= NOW())`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const dbPool = getPool();

    if (req.method === 'GET') {
      const id = req.query?.id;
      const slug = req.query?.slug;

      if (id) {
        const result = await dbPool.query(
          `SELECT * FROM blogs WHERE id = $1 AND ${LIVE_CLAUSE}`,
          [id]
        );
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Blog not found' });
        }
        return res.status(200).json(mapBlogRow(result.rows[0]));
      }

      if (slug) {
        const result = await dbPool.query(
          `SELECT * FROM blogs WHERE slug = $1 AND ${LIVE_CLAUSE}`,
          [slug]
        );
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Blog not found' });
        }
        return res.status(200).json(mapBlogRow(result.rows[0]));
      }

      const page = parseInt(req.query?.page, 10) || 1;
      const limit = Math.min(parseInt(req.query?.limit, 10) || 10, 50);
      const category = req.query?.category ? String(req.query.category).trim() : '';
      const qRaw = req.query?.q;
      const q = qRaw != null && String(qRaw).trim() ? String(qRaw).trim() : '';
      const offset = (page - 1) * limit;

      const conditions = [LIVE_CLAUSE];
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
        `SELECT * FROM blogs ${whereClause} ORDER BY published_at DESC NULLS LAST, created_at DESC LIMIT $${limIdx} OFFSET $${offIdx}`,
        listParams
      );

      const catsResult = await dbPool.query(
        `SELECT DISTINCT category FROM blogs
         WHERE ${LIVE_CLAUSE} AND category IS NOT NULL AND TRIM(category) <> ''
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
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
      blogs: []
    });
  }
};
