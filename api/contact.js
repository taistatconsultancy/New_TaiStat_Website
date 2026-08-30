// Contact form — validated server-side, stored in Supabase, optional Google Sheet sync
const crypto = require('crypto');
const { getPool } = require('./_db');
const { validateEmail, looksLikeSpamText, normalizeEmail } = require('./_email');

const GOOGLE_FORM_URL =
  process.env.GOOGLE_CONTACT_FORM_URL ||
  'https://docs.google.com/forms/d/e/1FAIpQLScM3V1JfhP7NK2hvU5E8GssgeQWamCndDe7YNNj8ZUbeBhMqA/formResponse';

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5;

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

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) {
    return fwd.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function ipHash(ip) {
  const salt = process.env.CONTACT_RATE_SALT || 'taistat-contact';
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

async function isRateLimited(pool, hash) {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS c FROM contact_submissions
     WHERE ip_hash = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [hash]
  );
  return (r.rows[0]?.c || 0) >= RATE_LIMIT_MAX;
}

async function appendToGoogleSheet({ name, email, subject, message }) {
  if (process.env.CONTACT_SKIP_GOOGLE_SHEET === 'true') return;

  const body = new URLSearchParams({
    'entry.318758003': name,
    'entry.897678316': email,
    'entry.2110515807': subject,
    'entry.1680519114': message
  });

  await fetch(GOOGLE_FORM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  }).catch((err) => {
    console.error('Google Sheet sync failed:', err.message);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await readJson(req);

    // Honeypot — bots fill hidden "website" field
    if (body.website && String(body.website).trim()) {
      return res.status(200).json({ ok: true, message: 'Thank you.' });
    }

    const name = String(body.name || '').trim().slice(0, 200);
    const subject = String(body.subject || '').trim().slice(0, 500);
    const message = String(body.message || '').trim().slice(0, 5000);

    if (!name || !subject || !message) {
      return res.status(400).json({ error: 'Name, subject, and message are required.' });
    }

    if (looksLikeSpamText(name) || looksLikeSpamText(subject)) {
      return res.status(400).json({ error: 'Your submission could not be sent. Please use real details.' });
    }

    const emailCheck = await validateEmail(body.email);
    if (!emailCheck.ok) {
      return res.status(400).json({ error: emailCheck.reason });
    }
    const email = emailCheck.email;

    const pool = getPool();
    const hash = ipHash(clientIp(req));

    if (await isRateLimited(pool, hash)) {
      return res.status(429).json({ error: 'Too many messages from this connection. Try again later.' });
    }

    await pool.query(
      `INSERT INTO contact_submissions (name, email, subject, message, ip_hash, user_agent, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'accepted')`,
      [name, email, subject, message, hash, String(req.headers['user-agent'] || '').slice(0, 500)]
    );

    await appendToGoogleSheet({ name, email, subject, message });

    return res.status(200).json({ ok: true, message: 'Your message was sent. We will reply by email.' });
  } catch (error) {
    console.error('contact API error:', error);
    return res.status(500).json({ error: 'Could not send your message. Please email taistatfirm@gmail.com directly.' });
  }
};
