const { createClient } = require('@supabase/supabase-js');

let client;

function getSupabaseAdmin() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required');
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return client;
}

const MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || 'taistat-media';

module.exports = { getSupabaseAdmin, MEDIA_BUCKET };
