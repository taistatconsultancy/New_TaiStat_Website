const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    const dbUrl = process.env.NEON_DATABASE_URL;
    const config = { connectionString: dbUrl };
    if (dbUrl && !dbUrl.includes('sslmode=')) {
      config.ssl = { rejectUnauthorized: false };
    }
    pool = new Pool(config);
  }
  return pool;
}

module.exports = { getPool };
