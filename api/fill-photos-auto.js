// 배포가 끝나면 GitHub Actions(.github/workflows/fill-photos.yml)가 호출 → 남은 사진 자리를 자동으로 채움
// 채울 자리가 없으면 아무것도 안 함. 채우면 저장(커밋) → 재배포 → 다시 호출되지만 그땐 할 일이 없음
// Vercel 환경변수 FILL_PHOTOS_SECRET 이 있으면 같은 값을 X-Fill-Secret 헤더로 보내야 함
const crypto = require('crypto');
const { config } = require('./_lib/admin');
const { fillAllPhotoSlots } = require('./_lib/fill-photos-core');

const same = (a, b) => crypto.timingSafeEqual(
  crypto.createHash('sha256').update(String(a)).digest(),
  crypto.createHash('sha256').update(String(b)).digest(),
);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'POST' || req.headers['x-weddingscoop-fill'] !== '1') return res.status(404).json({ error: 'Not found' });
  const secret = process.env.FILL_PHOTOS_SECRET;
  if (secret && !same(req.headers['x-fill-secret'] || '', secret)) return res.status(403).json({ error: 'Forbidden' });
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key || !config().GITHUB_TOKEN) return res.status(200).json({ ok: false, skipped: 'UNSPLASH_ACCESS_KEY 또는 GITHUB_TOKEN 없음' });
  try {
    const r = await fillAllPhotoSlots(key);
    res.status(200).json(r);
  } catch (e) {
    console.error('[fill-photos-auto]', e);
    res.status(500).json({ error: e.message });
  }
};
