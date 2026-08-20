// Upload images to Supabase Storage (admin JWT required)
const { requireAdmin } = require('./_auth');
const { getSupabaseAdmin, MEDIA_BUCKET } = require('./_supabase');

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

function parseDataUrl(dataUrl) {
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { contentType: m[1], buffer: Buffer.from(m[2], 'base64') };
}

function extFromType(contentType) {
  if (!contentType) return 'bin';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  if (contentType.includes('svg')) return 'svg';
  return 'bin';
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = requireAdmin(req, res);
  if (!admin) return;

  try {
    const body = await readJson(req);
    const { image, folder } = body;

    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const parsed = parseDataUrl(image);
    if (!parsed) {
      return res.status(400).json({ error: 'Expected a base64 data URL' });
    }

    const supabase = getSupabaseAdmin();
    const folderSafe = String(folder || 'uploads')
      .replace(/[^a-zA-Z0-9/_-]/g, '')
      .replace(/^\/+|\/+$/g, '') || 'uploads';
    const ext = extFromType(parsed.contentType);
    const path = `${folderSafe}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

    // Ensure bucket exists (idempotent)
    await supabase.storage.createBucket(MEDIA_BUCKET, { public: true }).catch(() => {});

    const { error: upErr } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, parsed.buffer, {
        contentType: parsed.contentType,
        upsert: false
      });

    if (upErr) {
      console.error('Supabase upload error:', upErr);
      return res.status(500).json({ error: 'Failed to upload image', details: upErr.message });
    }

    const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);

    return res.status(200).json({
      url: data.publicUrl,
      path,
      bucket: MEDIA_BUCKET
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Failed to upload image', details: error.message });
  }
};
