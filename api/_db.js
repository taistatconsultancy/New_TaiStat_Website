const { Pool } = require('pg');

let pool;

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Rebuild Postgres URLs so passwords with @ [ ] etc. are percent-encoded once.
 */
function resolveDatabaseUrl() {
  const raw =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.DIRECT_URL ||
    process.env.NEON_DATABASE_URL;

  if (!raw) return null;

  const cleaned = String(raw).trim().replace(/^["']|["']$/g, '');

  const m = cleaned.match(/^(postgres(?:ql)?:\/\/)([^:\/?#]+):(.+)@([^\/?#]+)(\/[^?]*)?(\?.*)?$/i);
  if (!m) return cleaned;

  const [, proto, user, pass, host, pathPart = '', query = ''] = m;
  const userDecoded = safeDecode(user);
  const passDecoded = safeDecode(pass);

  return (
    `${proto}${encodeURIComponent(userDecoded)}:${encodeURIComponent(passDecoded)}@${host}` +
    `${pathPart || ''}${query || ''}`
  );
}

function getPool() {
  if (!pool) {
    const dbUrl = resolveDatabaseUrl();
    if (!dbUrl) {
      throw new Error('DATABASE_URL (or SUPABASE_DATABASE_URL) is not set');
    }
    const config = {
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false }
    };
    if (dbUrl.includes('pgbouncer=true') || dbUrl.includes(':6543')) {
      config.max = 1;
    }
    pool = new Pool(config);
  }
  return pool;
}

module.exports = { getPool, resolveDatabaseUrl };
