// 어드민 화면: weddingscoop.co.kr/admin/<ADMIN_URL_KEY> 로만 열림 (그 외 주소는 404)
const fs = require('fs');
const path = require('path');
const { config, safeEqual } = require('../_lib/admin');

module.exports = (req, res) => {
  const { ADMIN_URL_KEY } = config();
  const key = String((req.query && req.query.key) || '');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');
  if (!ADMIN_URL_KEY || !key || !safeEqual(key, ADMIN_URL_KEY)) {
    res.status(404).setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('404 Not Found');
    return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.status(200).end(fs.readFileSync(path.join(__dirname, '..', '_lib', 'admin-page.html'), 'utf8'));
};
