// 박람회 이미지를 우리 주소로 제공: /expo-img/data/ad/…jpg → https://ad.cpaad.co.kr/data/ad/…jpg
// (vercel.json rewrite, 서울 리전) — 원본 서버는 해외에서 접속이 안 되고,
// 네이버 검색 결과 이미지 묶음에는 이 사이트 주소의 이미지가 유리함
// 원본 주소는 ad.cpaad.co.kr 로 고정이라 다른 사이트를 대신 받아 주는 용도로는 못 씀

const ORIGIN = 'https://ad.cpaad.co.kr/';
const PATH_RE = /^data\/[\w./-]+\.(?:jpe?g|png|gif|webp)$/i;
const MAX_BYTES = 5 * 1024 * 1024;

module.exports = async (req, res) => {
  const p = String((req.query && req.query.p) || '').replace(/^\/+/, '');
  if (!PATH_RE.test(p) || p.includes('..')) return res.status(404).end();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const upstream = await fetch(ORIGIN + p, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WeddingScoop/1.0)', Accept: 'image/*' },
      signal: controller.signal,
    });
    const type = upstream.headers.get('content-type') || '';
    if (!upstream.ok || !type.startsWith('image/')) {
      res.setHeader('Cache-Control', 'public, s-maxage=600');
      return res.status(upstream.status === 404 ? 404 : 502).end();
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > MAX_BYTES) return res.status(502).end();
    res.setHeader('Content-Type', type);
    // 원본 파일 이름이 해시라 내용이 바뀌지 않음 → 오래 캐시
    res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400');
    res.status(200).send(buf);
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(504).end();
  } finally {
    clearTimeout(timer);
  }
};
