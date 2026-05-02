// Vercel Serverless Function - Upload image to Cloudinary (admin JWT required)
const cloudinary = require('cloudinary').v2;
const { requireAdmin } = require('./_auth');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

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

    const uploadFolder = folder || 'taistat-uploads';

    const uploadResult = await cloudinary.uploader.upload(image, {
      folder: uploadFolder,
      resource_type: 'auto'
    });

    return res.status(200).json({
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id
    });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    return res.status(500).json({ error: 'Failed to upload image', details: error.message });
  }
};
