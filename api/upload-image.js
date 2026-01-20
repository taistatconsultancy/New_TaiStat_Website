// Vercel Serverless Function - Upload image to Cloudinary
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple auth check
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.ADMIN_API_KEY}`;
  
  if (!authHeader || authHeader !== expectedAuth) {
    return res.status(401).json({ error: 'Unauthorized. Please check your API key.' });
  }

  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(image, {
      folder: 'taistat-blogs',
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
}
