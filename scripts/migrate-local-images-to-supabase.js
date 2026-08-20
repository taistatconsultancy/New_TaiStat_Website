require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { getPool } = require('../api/_db');

const MEDIA = process.env.SUPABASE_MEDIA_BUCKET || 'taistat-media';
const ctype = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif'
};

async function main() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false }
  });
  const pool = getPool();

  const { rows } = await pool.query(
    `SELECT id, slug, featured_image_url FROM blogs
     WHERE featured_image_url IS NOT NULL
       AND featured_image_url NOT ILIKE '%supabase.co%'`
  );

  for (const row of rows) {
    const rel = String(row.featured_image_url).replace(/^\/+/, '');
    const file = path.join(process.cwd(), rel);
    if (!fs.existsSync(file)) {
      console.log('missing local file:', rel);
      continue;
    }
    const ext = (path.extname(file).slice(1) || 'jpg').toLowerCase();
    const buf = fs.readFileSync(file);
    const objectPath = `blogs/${row.slug}.${ext}`;
    const { error } = await supabase.storage.from(MEDIA).upload(objectPath, buf, {
      contentType: ctype[ext] || 'image/jpeg',
      upsert: true
    });
    if (error) {
      console.log('fail', row.slug, error.message);
      continue;
    }
    const { data } = supabase.storage.from(MEDIA).getPublicUrl(objectPath);
    await pool.query('UPDATE blogs SET featured_image_url = $1 WHERE id = $2', [
      data.publicUrl,
      row.id
    ]);
    console.log('uploaded', row.slug);
  }

  // Also migrate local project images if any remain
  const projects = await pool.query(
    `SELECT id, slug, image_url FROM projects
     WHERE image_url IS NOT NULL
       AND image_url NOT ILIKE 'http%'
       AND image_url NOT ILIKE '%supabase.co%'`
  );
  for (const row of projects.rows) {
    const rel = String(row.image_url).replace(/^\/+/, '');
    const file = path.join(process.cwd(), rel);
    if (!fs.existsSync(file)) {
      console.log('missing project file:', rel);
      continue;
    }
    const ext = (path.extname(file).slice(1) || 'jpg').toLowerCase();
    const buf = fs.readFileSync(file);
    const objectPath = `projects/${row.slug}.${ext}`;
    const { error } = await supabase.storage.from(MEDIA).upload(objectPath, buf, {
      contentType: ctype[ext] || 'image/jpeg',
      upsert: true
    });
    if (error) {
      console.log('fail project', row.slug, error.message);
      continue;
    }
    const { data } = supabase.storage.from(MEDIA).getPublicUrl(objectPath);
    await pool.query('UPDATE projects SET image_url = $1 WHERE id = $2', [data.publicUrl, row.id]);
    console.log('uploaded project', row.slug);
  }

  await pool.end();
  console.log('Local media migration done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
