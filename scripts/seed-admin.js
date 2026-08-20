/**
 * Create / refresh the first admin user in Supabase Postgres (run once).
 * Required: DATABASE_URL (or SUPABASE_DATABASE_URL),
 *           ADMIN_SEED_USERNAME, ADMIN_SEED_PASSWORD, ADMIN_SEED_EMAIL
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getPool, resolveDatabaseUrl } = require('../api/_db');

async function seed() {
  const username = process.env.ADMIN_SEED_USERNAME || process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_SEED_PASSWORD || process.env.ADMIN_PASSWORD;
  const email =
    process.env.ADMIN_SEED_EMAIL ||
    process.env.ADMIN_EMAIL ||
    `${username || 'admin'}@taistat.local`;

  if (!resolveDatabaseUrl()) {
    console.error('DATABASE_URL (or SUPABASE_DATABASE_URL) is required');
    process.exit(1);
  }
  const pool = getPool();
  if (!username || !password) {
    console.error('Set ADMIN_SEED_USERNAME and ADMIN_SEED_PASSWORD (or ADMIN_USERNAME / ADMIN_PASSWORD)');
    process.exit(1);
  }

  const hash = bcrypt.hashSync(password, 12);

  const result = await pool.query(
    `INSERT INTO admin_users (username, email, password_hash, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (username) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       email = EXCLUDED.email,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id, username, email`,
    [username, email, hash]
  );

  console.log('Admin user ready:', result.rows[0]);
  await pool.end();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
