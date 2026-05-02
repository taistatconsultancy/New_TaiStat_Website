// Script to set up the database schema
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configure pool - Neon requires SSL
const dbUrl = process.env.NEON_DATABASE_URL;
let poolConfig = {
  connectionString: dbUrl
};

// Add SSL config if not already in connection string
if (dbUrl && !dbUrl.includes('sslmode=')) {
  poolConfig.ssl = {
    rejectUnauthorized: false
  };
}

const pool = new Pool(poolConfig);

async function setupDatabase() {
  try {
    // Check environment variables
    if (!process.env.NEON_DATABASE_URL) {
      console.error('Error: NEON_DATABASE_URL is not set in environment variables');
      console.error('Please create a .env file with NEON_DATABASE_URL');
      process.exit(1);
    }

    console.log('Setting up database schema...');
    console.log(`Database: ${process.env.NEON_DATABASE_URL.substring(0, 30)}...`);

    // Read SQL schema file
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema
    await pool.query(schemaSQL);

    console.log('✓ Database schema created successfully!');
    console.log('✓ Tables: blogs, admin_users, projects');
    console.log('✓ Indexes and triggers created');
    
    await pool.end();
  } catch (error) {
    console.error('Database setup error:', error.message);
    if (error.code === '42P07') {
      console.log('Note: Some tables might already exist. This is okay.');
    } else {
      await pool.end();
      process.exit(1);
    }
  }
}

// Run setup
setupDatabase();
