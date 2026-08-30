const dns = require('dns').promises;

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/** Common disposable / throwaway domains (subset) */
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'tempmail.com',
  '10minutemail.com',
  'yopmail.com',
  'throwaway.email',
  'getnada.com',
  'sharklasers.com',
  'trashmail.com',
  'maildrop.cc',
  'fakeinbox.com',
  'dispostable.com',
  'mailnesia.com',
  'temp-mail.org',
  'emailondeck.com',
  'mintemail.com',
  'spam4.me',
  'grr.la',
  'guerrillamailblock.com'
]);

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function emailDomain(email) {
  const at = email.lastIndexOf('@');
  return at > 0 ? email.slice(at + 1) : '';
}

async function hasMxRecords(domain) {
  try {
    const mx = await dns.resolveMx(domain);
    return Array.isArray(mx) && mx.length > 0;
  } catch {
    try {
      const a = await dns.resolve4(domain);
      return Array.isArray(a) && a.length > 0;
    } catch {
      return false;
    }
  }
}

function looksLikeSpamText(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  if (t.length > 5000) return true;
  // Random keyboard mash: long token with no spaces
  if (/^[A-Za-z]{18,}$/.test(t.replace(/\s/g, ''))) return true;
  // Too many URLs
  const urls = t.match(/https?:\/\//gi) || [];
  if (urls.length > 2) return true;
  return false;
}

/**
 * Validate email: format, disposable domain, live MX/A records.
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
async function validateEmail(emailRaw) {
  const email = normalizeEmail(emailRaw);
  if (!email || email.length > 254) {
    return { ok: false, reason: 'Please enter a valid email address.' };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, reason: 'That email address does not look valid.' };
  }

  const domain = emailDomain(email);
  if (!domain || domain.length < 3 || !domain.includes('.')) {
    return { ok: false, reason: 'That email domain is not valid.' };
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { ok: false, reason: 'Please use a permanent email address, not a temporary one.' };
  }

  const mxOk = await hasMxRecords(domain);
  if (!mxOk) {
    return { ok: false, reason: 'We could not verify that email domain. Please check for typos.' };
  }

  return { ok: true, email };
}

module.exports = {
  validateEmail,
  looksLikeSpamText,
  normalizeEmail,
  emailDomain
};
