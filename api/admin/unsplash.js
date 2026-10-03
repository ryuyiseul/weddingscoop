// 어드민 무료 사진 검색 (Unsplash)
//   GET  ?q=웨딩&page=1   검색
//   POST ?track=<download_location>  사진을 글에 넣었다고 Unsplash에 알림 (Unsplash 이용 규칙)
// Vercel 환경변수: UNSPLASH_ACCESS_KEY (unsplash.com/developers 에서 발급)
const { guard } = require('../_lib/admin');

const API = 'https://api.unsplash.com';
const UTM = 'utm_source=weddingscoop&utm_medium=referral';
const withUtm = (url) => `${url}${url.includes('?') ? '&' : '?'}${UTM}`;

async function unsplash(path, key) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
  });
  if (res.status === 401) throw Object.assign(new Error('UNSPLASH_ACCESS_KEY 값이 올바르지 않습니다'), { status: 500 });
  if (res.status === 403) throw Object.assign(new Error('Unsplash 시간당 검색 한도를 넘었습니다. 잠시 후 다시 시도해주세요'), { status: 429 });
  if (!res.ok) throw Object.assign(new Error(`Unsplash 오류 (${res.status})`), { status: 502 });
  return res.json();
}

module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    res.status(503).json({ error: 'UNSPLASH_ACCESS_KEY가 설정되지 않았습니다', setup: true });
    return;
  }
  try {
    if (req.method === 'GET') {
      const q = String((req.query && req.query.q) || '').trim().slice(0, 100);
      const page = Math.max(1, Math.min(50, parseInt((req.query && req.query.page) || '1', 10) || 1));
      if (!q) return res.status(400).json({ error: '검색어를 입력해주세요' });
      const params = new URLSearchParams({ query: q, page: String(page), per_page: '24', content_filter: 'high' });
      if (/[가-힣]/.test(q)) params.set('lang', 'ko');
      const data = await unsplash(`/search/photos?${params}`, key);
      res.status(200).json({
        total: data.total,
        totalPages: data.total_pages,
        photos: (data.results || []).map(p => ({
          id: p.id,
          width: p.width,
          height: p.height,
          color: p.color,
          thumb: p.urls.small,
          // 본문용: 가로 1600px, 자동 포맷
          url: `${p.urls.raw}&w=1600&q=80&auto=format&fit=max`,
          alt: p.alt_description || p.description || '',
          author: p.user.name,
          authorUrl: withUtm(p.user.links.html),
          unsplashUrl: withUtm('https://unsplash.com/'),
          downloadLocation: p.links.download_location,
        })),
      });
      return;
    }
    if (req.method === 'POST') {
      const track = String((req.query && req.query.track) || '');
      if (!/^https:\/\/api\.unsplash\.com\/photos\/[A-Za-z0-9_-]+\/download/.test(track)) {
        return res.status(400).json({ error: '잘못된 요청입니다' });
      }
      await unsplash(track.slice(API.length), key);
      return res.status(200).json({ ok: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
};
