/**
 * Normalize stored URLs so img/src works from any route (e.g. /blog/slug).
 */
const DEFAULT_IMG =
  'https://placehold.co/960x540/1e3a5f/ffffff?text=TaiStat';

/** @returns {string|null} */
function normalizeAssetUrl(url) {
  if (url == null || url === '') return null;
  const t = String(url).trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith('//')) return `https:${t}`;
  if (t.startsWith('/')) return t;
  return `/${t.replace(/^\.+\//, '')}`;
}

function normalizePublicUrl(url, fallback = DEFAULT_IMG) {
  const n = normalizeAssetUrl(url);
  return n || fallback;
}

function mapBlogRow(row, fallbackImg = DEFAULT_IMG) {
  if (!row) return row;
  return {
    ...row,
    featured_image_url: normalizePublicUrl(row.featured_image_url, fallbackImg)
  };
}

function mapProjectRow(row) {
  if (!row) return row;
  return {
    ...row,
    image_url: normalizeAssetUrl(row.image_url)
  };
}

module.exports = {
  normalizePublicUrl,
  normalizeAssetUrl,
  mapBlogRow,
  mapProjectRow,
  DEFAULT_IMG
};
