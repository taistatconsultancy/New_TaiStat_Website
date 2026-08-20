/**
 * Migrate Neon blogs/projects/admin_users → Supabase Postgres,
 * re-host images in Supabase Storage, then wipe Neon + Cloudinary.
 *
 * Usage (while NEON_* and CLOUDINARY_* still in .env):
 *   node scripts/migrate-neon-to-supabase.js
 *   node scripts/migrate-neon-to-supabase.js --wipe-sources
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const { resolveDatabaseUrl } = require('../api/_db');

const MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || 'taistat-media';
const wipe = process.argv.includes('--wipe-sources');

function makePool(connectionString) {
  if (!connectionString) throw new Error('Missing connection string');
  let url = connectionString;
  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    const m = url.match(/^(postgres(?:ql)?:\/\/)([^:]+):(.+)@([^/]+)(\/.*)?$/i);
    if (m) {
      const [, proto, user, pass, host, pth = '/'] = m;
      url = `${proto}${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}${pth}`;
    }
  }
  const config = { connectionString: url };
  if (!url.includes('sslmode=')) config.ssl = { rejectUnauthorized: false };
  return new Pool(config);
}

function extFromContentType(ct, fallbackUrl) {
  if (ct && ct.includes('jpeg')) return 'jpg';
  if (ct && ct.includes('png')) return 'png';
  if (ct && ct.includes('webp')) return 'webp';
  if (ct && ct.includes('gif')) return 'gif';
  const m = String(fallbackUrl || '').match(/\.(jpe?g|png|webp|gif)(\?|$)/i);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
}

async function ensureBucket(supabase) {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = (buckets || []).some((b) => b.name === MEDIA_BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(MEDIA_BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024
    });
    if (error && !/already exists/i.test(error.message)) {
      throw error;
    }
    console.log('Created storage bucket:', MEDIA_BUCKET);
  } else {
    console.log('Storage bucket ready:', MEDIA_BUCKET);
  }
}

async function migrateImage(supabase, url, folder) {
  if (!url || !/^https?:\/\//i.test(url)) return url;
  if (url.includes('supabase.co/storage')) return url;

  const res = await fetch(url);
  if (!res.ok) {
    console.warn('  skip image (HTTP', res.status + '):', url.slice(0, 80));
    return url;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get('content-type') || 'image/jpeg';
  const ext = extFromContentType(ct, url);
  const objectPath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(objectPath, buf, {
    contentType: ct,
    upsert: true
  });
  if (error) {
    console.warn('  upload failed:', error.message, url.slice(0, 60));
    return url;
  }
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

async function wipeCloudinary() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret) {
    console.log('Cloudinary credentials missing — skip wipe');
    return;
  }
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  let nextCursor = undefined;
  let deleted = 0;
  do {
    const qs = new URLSearchParams({ max_results: '100', type: 'upload' });
    if (nextCursor) qs.set('next_cursor', nextCursor);
    const listRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloud}/resources/image?${qs}`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    if (!listRes.ok) {
      console.warn('Cloudinary list failed:', listRes.status, await listRes.text());
      break;
    }
    const list = await listRes.json();
    const ids = (list.resources || []).map((r) => r.public_id);
    if (ids.length) {
      const delRes = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/resources/image/upload`, {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ public_ids: ids })
      });
      if (delRes.ok) deleted += ids.length;
      else console.warn('Cloudinary delete warn:', await delRes.text());
    }
    nextCursor = list.next_cursor;
  } while (nextCursor);
  console.log('Cloudinary images deleted (approx):', deleted);
}

async function main() {
  const neonUrl = process.env.NEON_DATABASE_URL;
  const supabaseDb = resolveDatabaseUrl();
  if (!neonUrl) throw new Error('NEON_DATABASE_URL required for source');
  if (!supabaseDb) throw new Error('DATABASE_URL / SUPABASE_DATABASE_URL required for target');
  if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY required');
  }

  const neon = makePool(neonUrl);
  const dest = makePool(supabaseDb);
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  console.log('Applying schema on Supabase…');
  const schemaSQL = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  await dest.query(schemaSQL);

  await ensureBucket(supabase);

  const blogs = (await neon.query('SELECT * FROM blogs ORDER BY id')).rows;
  const projects = (await neon.query('SELECT * FROM projects ORDER BY id')).rows;
  const admins = (await neon.query('SELECT * FROM admin_users ORDER BY id')).rows;
  console.log(`Source: ${blogs.length} blogs, ${projects.length} projects, ${admins.length} admins`);

  for (const b of blogs) {
    console.log('Blog:', b.slug);
    const image = await migrateImage(supabase, b.featured_image_url, 'blogs');
    await dest.query(
      `INSERT INTO blogs (
        id, title, slug, excerpt, content, featured_image_url, author, category, tags,
        published, published_at, created_at, updated_at, views, meta_description, meta_keywords
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9::text[],
        $10,$11,$12,$13,$14,$15,$16
      )
      ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        excerpt = EXCLUDED.excerpt,
        content = EXCLUDED.content,
        featured_image_url = EXCLUDED.featured_image_url,
        author = EXCLUDED.author,
        category = EXCLUDED.category,
        tags = EXCLUDED.tags,
        published = EXCLUDED.published,
        published_at = EXCLUDED.published_at,
        updated_at = EXCLUDED.updated_at,
        views = EXCLUDED.views,
        meta_description = EXCLUDED.meta_description,
        meta_keywords = EXCLUDED.meta_keywords`,
      [
        b.id,
        b.title,
        b.slug,
        b.excerpt,
        b.content,
        image,
        b.author,
        b.category,
        b.tags || [],
        b.published,
        b.published_at || b.created_at,
        b.created_at,
        b.updated_at,
        b.views || 0,
        b.meta_description,
        b.meta_keywords
      ]
    );
  }

  for (const p of projects) {
    console.log('Project:', p.slug);
    const image = await migrateImage(supabase, p.image_url, 'projects');
    await dest.query(
      `INSERT INTO projects (
        id, title, slug, summary, description, category, features,
        image_url, project_url, secondary_url, featured, published, sort_order,
        created_at, updated_at, problem_statement, outcome_text, client_name,
        project_type, status_label, tech_tags
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7::text[],
        $8,$9,$10,$11,$12,$13,
        $14,$15,$16,$17,$18,
        $19,$20,$21::text[]
      )
      ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        features = EXCLUDED.features,
        image_url = EXCLUDED.image_url,
        project_url = EXCLUDED.project_url,
        secondary_url = EXCLUDED.secondary_url,
        featured = EXCLUDED.featured,
        published = EXCLUDED.published,
        sort_order = EXCLUDED.sort_order,
        updated_at = EXCLUDED.updated_at,
        problem_statement = EXCLUDED.problem_statement,
        outcome_text = EXCLUDED.outcome_text,
        client_name = EXCLUDED.client_name,
        project_type = EXCLUDED.project_type,
        status_label = EXCLUDED.status_label,
        tech_tags = EXCLUDED.tech_tags`,
      [
        p.id,
        p.title,
        p.slug,
        p.summary,
        p.description,
        p.category,
        p.features || [],
        image,
        p.project_url,
        p.secondary_url,
        !!p.featured,
        p.published !== false,
        p.sort_order || 0,
        p.created_at,
        p.updated_at,
        p.problem_statement,
        p.outcome_text,
        p.client_name,
        p.project_type,
        p.status_label,
        p.tech_tags || []
      ]
    );
  }

  for (const a of admins) {
    console.log('Admin:', a.username);
    await dest.query(
      `INSERT INTO admin_users (id, username, email, password_hash, created_at, last_login, role, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (username) DO UPDATE SET
         email = EXCLUDED.email,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         last_login = EXCLUDED.last_login`,
      [
        a.id,
        a.username,
        a.email,
        a.password_hash,
        a.created_at,
        a.last_login,
        a.role || 'admin',
        a.updated_at || a.created_at
      ]
    );
  }

  // Keep serial sequences in sync
  await dest.query(`SELECT setval(pg_get_serial_sequence('blogs','id'), COALESCE((SELECT MAX(id) FROM blogs), 1), true)`);
  await dest.query(`SELECT setval(pg_get_serial_sequence('projects','id'), COALESCE((SELECT MAX(id) FROM projects), 1), true)`);
  await dest.query(`SELECT setval(pg_get_serial_sequence('admin_users','id'), COALESCE((SELECT MAX(id) FROM admin_users), 1), true)`);

  console.log('Migration into Supabase complete.');

  if (wipe) {
    console.log('Wiping Neon tables…');
    await neon.query('TRUNCATE TABLE blogs, projects, admin_users RESTART IDENTITY CASCADE');
    console.log('Neon wiped.');
    await wipeCloudinary();
  } else {
    console.log('Skipped source wipe. Re-run with --wipe-sources after verifying Supabase data.');
  }

  await neon.end();
  await dest.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
