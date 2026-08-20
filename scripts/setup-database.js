// Apply schema to Supabase Postgres
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getPool, resolveDatabaseUrl } = require('../api/_db');

async function setupDatabase() {
  try {
    if (!resolveDatabaseUrl()) {
      console.error('Error: DATABASE_URL (or SUPABASE_DATABASE_URL) is not set');
      process.exit(1);
    }

    console.log('Setting up database schema on Supabase…');
    const pool = getPool();
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schemaSQL);

    console.log('✓ Schema ready (blogs, admin_users, projects)');
    await pool.end();
  } catch (error) {
    console.error('Database setup error:', error.message);
    process.exit(1);
  }
}

setupDatabase();
