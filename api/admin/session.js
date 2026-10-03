// 어드민 로그인 상태 확인(GET) / 로그인(POST) / 로그아웃(DELETE)
const { config, safeEqual, createSessionCookie, clearSessionCookie, isLoggedIn, readJson } = require('../_lib/admin');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const { ADMIN_PASSWORD, missing } = config();

  if (req.method === 'GET') {
    res.status(200).json({ loggedIn: isLoggedIn(req), missing });
    return;
  }
  if (req.headers['x-admin-request'] !== '1') {
    res.status(403).json({ error: '잘못된 요청입니다' });
    return;
  }
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearSessionCookie());
    res.status(200).json({ ok: true });
    return;
  }
  if (req.method === 'POST') {
    if (missing.length) {
      res.status(500).json({ error: `Vercel 환경변수가 설정되지 않았습니다: ${missing.join(', ')}` });
      return;
    }
    const { password } = await readJson(req).catch(() => ({}));
    if (!password || !safeEqual(password, ADMIN_PASSWORD)) {
      await new Promise(r => setTimeout(r, 1000)); // 비밀번호 무작위 대입 지연
      res.status(401).json({ error: '비밀번호가 틀렸습니다' });
      return;
    }
    res.setHeader('Set-Cookie', createSessionCookie());
    res.status(200).json({ ok: true });
    return;
  }
  res.status(405).json({ error: 'Method not allowed' });
};
