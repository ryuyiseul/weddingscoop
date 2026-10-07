// 배포가 끝나면 GitHub Actions(.github/workflows/fill-photos.yml)가 호출 → 남은 사진 자리를 자동으로 채움
// 채울 자리가 없으면 아무것도 안 함. 채우면 저장(커밋) → 재배포 → 다시 호출되지만 그땐 할 일이 없음
// 이 저장소의 GitHub Actions가 보낸 신원 증명 토큰(OIDC)이 있어야만 실행됨
const { config } = require('./_lib/admin');
const { verifyGithubOidc } = require('./_lib/github-oidc');
const { fillAllPhotoSlots } = require('./_lib/fill-photos-core');

const REPO = process.env.GITHUB_REPO || 'ryuyiseul/weddingscoop';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'POST') return res.status(404).json({ error: 'Not found' });
  let claims = null;
  try {
    claims = await verifyGithubOidc(req.headers.authorization, { audience: 'weddingscoop-fill', repository: REPO });
  } catch (e) {
    console.error('[fill-photos-auto] OIDC', e);
  }
  if (!claims) return res.status(403).json({ error: 'Forbidden' });
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
