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

function normalizeFeatures(features) {
  if (!features) return [];
  if (Array.isArray(features)) return features.filter(Boolean).map(String);
  if (typeof features === 'string') {
    return features
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeTechTags(tags) {
  return normalizeFeatures(tags);
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
        const result = await dbPool.query('SELECT * FROM projects WHERE id = $1', [id]);
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Project not found' });
        }
        return res.status(200).json(result.rows[0]);
      }
      const result = await dbPool.query(
        'SELECT * FROM projects ORDER BY sort_order ASC NULLS LAST, created_at DESC'
      );
      return res.status(200).json({ projects: result.rows });
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const {
        title,
        slug: slugInput,
        summary,
        description,
        category,
        features,
        image_url,
        project_url,
        secondary_url,
        featured,
        published,
        sort_order,
        problem_statement,
        outcome_text,
        client_name,
        project_type,
        status_label,
        tech_tags
      } = body;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const slug = (slugInput && String(slugInput).trim()) || generateSlug(title);
      const dup = await dbPool.query('SELECT id FROM projects WHERE slug = $1', [slug]);
      if (dup.rows.length > 0) {
        return res.status(400).json({ error: 'A project with this slug already exists' });
      }

      const featArr = normalizeFeatures(features);
      const techArr = normalizeTechTags(tech_tags);

      const result = await dbPool.query(
        `INSERT INTO projects (
          title, slug, summary, description, category, features,
          image_url, project_url, secondary_url, featured, published, sort_order,
          problem_statement, outcome_text, client_name, project_type, status_label, tech_tags
        ) VALUES (
          $1, $2, $3, $4, $5, $6::text[],
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18::text[]
        ) RETURNING *`,
        [
          title,
          slug,
          summary || null,
          description || '',
          category || null,
          featArr,
          image_url || null,
          project_url || null,
          secondary_url || null,
          !!featured,
          published !== false,
          sort_order != null ? parseInt(sort_order, 10) || 0 : 0,
          problem_statement || null,
          outcome_text || null,
          client_name || null,
          project_type || null,
          status_label || null,
          techArr
        ]
      );

      return res.status(201).json(result.rows[0]);
    }

    if (req.method === 'PUT') {
      const id = req.query?.id;
      const body = await readJson(req);

      if (!id) {
        return res.status(400).json({ error: 'Project ID is required' });
      }

      const {
        title,
        slug: slugInput,
        summary,
        description,
        category,
        features,
        image_url,
        project_url,
        secondary_url,
        featured,
        published,
        sort_order,
        problem_statement,
        outcome_text,
        client_name,
        project_type,
        status_label,
        tech_tags
      } = body;

      let newSlug = undefined;
      if (slugInput !== undefined && slugInput !== null && String(slugInput).trim()) {
        newSlug = String(slugInput)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      }

      if (newSlug) {
        const slugCheck = await dbPool.query(
          'SELECT id FROM projects WHERE slug = $1 AND id != $2',
          [newSlug, id]
        );
        if (slugCheck.rows.length > 0) {
          return res.status(400).json({ error: 'A project with this slug already exists' });
        }
      }

      const updates = [];
      const values = [];
      let paramCount = 1;

      const push = (col, val) => {
        updates.push(`${col} = $${paramCount++}`);
        values.push(val);
      };

      if (title !== undefined) push('title', title);
      if (newSlug !== undefined) push('slug', newSlug);
      if (summary !== undefined) push('summary', summary);
      if (description !== undefined) push('description', description);
      if (category !== undefined) push('category', category);
      if (features !== undefined) {
        updates.push(`features = $${paramCount++}::text[]`);
        values.push(normalizeFeatures(features));
      }
      if (image_url !== undefined) push('image_url', image_url);
      if (project_url !== undefined) push('project_url', project_url);
      if (secondary_url !== undefined) push('secondary_url', secondary_url);
      if (featured !== undefined) push('featured', !!featured);
      if (published !== undefined) push('published', !!published);
      if (sort_order !== undefined) push('sort_order', parseInt(sort_order, 10) || 0);
      if (problem_statement !== undefined) push('problem_statement', problem_statement);
      if (outcome_text !== undefined) push('outcome_text', outcome_text);
      if (client_name !== undefined) push('client_name', client_name);
      if (project_type !== undefined) push('project_type', project_type);
      if (status_label !== undefined) push('status_label', status_label);
      if (tech_tags !== undefined) {
        updates.push(`tech_tags = $${paramCount++}::text[]`);
        values.push(normalizeTechTags(tech_tags));
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(id);
      const query = `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

      const result = await dbPool.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      return res.status(200).json(result.rows[0]);
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id;

      if (!id) {
        return res.status(400).json({ error: 'Project ID is required' });
      }

      const result = await dbPool.query('DELETE FROM projects WHERE id = $1 RETURNING *', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      return res.status(200).json({ message: 'Project deleted successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('projects-admin error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
