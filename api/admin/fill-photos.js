// 모든 글의 사진 자리 [[사진:검색어|설명]] 를 언스플래시 무료사진으로 한 번에 채우기
//   POST → 글마다 서로 다른 사진, 커밋 1번 (→ 배포 1번)
// 검색은 검색어마다 1번만 (시간당 50번 한도 아끼기)
const { guard, listDir, readFile, commitFiles } = require('../_lib/admin');
const { parsePost, findPhotoSlots } = require('../../lib/post-format');

const API = 'https://api.unsplash.com';
const UTM = 'utm_source=weddingscoop&utm_medium=referral';
const withUtm = (url) => `${url}${url.includes('?') ? '&' : '?'}${UTM}`;
const clean = (s) => String(s || '').replace(/[\[\]\n\r|]/g, ' ').replace(/\s+/g, ' ').trim();

async function unsplash(path, key) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' } });
  if (res.status === 401) throw Object.assign(new Error('UNSPLASH_ACCESS_KEY 값이 올바르지 않습니다'), { status: 500 });
  if (res.status === 403) throw Object.assign(new Error('rate'), { rate: true });
  if (!res.ok) throw new Error(`Unsplash 오류 (${res.status})`);
  return res.json();
}

module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return res.status(503).json({ error: 'UNSPLASH_ACCESS_KEY가 설정되지 않았습니다', setup: true });

  try {
    // 1) 사진 자리가 있는 글 모으기
    const files = (await listDir('posts')).filter(f => f.type === 'file' && f.name.endsWith('.md') && !f.name.startsWith('_'));
    const posts = [];
    for (const f of files) {
      const src = await readFile(f.path);
      const slots = findPhotoSlots(src);
      if (slots.length) posts.push({ path: f.path, src, slots });
    }
    if (!posts.length) return res.status(200).json({ ok: true, posts: 0, photos: 0, message: '채울 사진 자리가 없어요' });

    // 2) 검색어마다 한 번씩 검색 (가로 사진 30장)
    const pools = {};
    let rateLimited = false;
    for (const q of [...new Set(posts.flatMap(p => p.slots.map(s => s.query)))]) {
      try {
        const data = await unsplash(`/search/photos?${new URLSearchParams({ query: q, per_page: '30', orientation: 'landscape', content_filter: 'high' })}`, key);
        pools[q] = data.results || [];
      } catch (e) {
        if (e.rate) { rateLimited = true; break; }
        throw e;
      }
    }

    // 3) 글마다 서로 다른 사진, 전체적으로는 덜 쓰인 사진부터
    const usage = new Map();
    const usedPhotos = new Map(); // id → download_location
    const changes = [];
    let placed = 0;
    for (const post of posts) {
      let src = post.src;
      const inPost = new Set();
      let firstUrl = '';
      for (const slot of post.slots) {
        const pool = pools[slot.query];
        if (!pool || !pool.length) continue;
        const photo = pool
          .filter(p => !inPost.has(p.id))
          .sort((a, b) => (usage.get(a.id) || 0) - (usage.get(b.id) || 0))[0];
        if (!photo) continue;
        inPost.add(photo.id);
        usage.set(photo.id, (usage.get(photo.id) || 0) + 1);
        usedPhotos.set(photo.id, photo.links.download_location);
        const url = `${photo.urls.raw}&w=1600&q=80&auto=format&fit=max`;
        const alt = clean(slot.alt) || clean(photo.alt_description) || '웨딩 사진';
        const md = `![${alt}](${url})\n▲ Photo by [${clean(photo.user.name)}](${withUtm(photo.user.links.html)}) on [Unsplash](${withUtm('https://unsplash.com/')})`;
        src = src.replace(slot.line, () => md);
        if (!firstUrl) firstUrl = url;
        placed++;
      }
      if (src === post.src) continue;
      // 대표 이미지가 비어 있으면 첫 사진으로
      const { meta } = parsePost(src, post.path);
      if (!meta.thumbnail && firstUrl) {
        src = src.replace(/^(---\r?\n[\s\S]*?)(\r?\n---)/, (m, head, end) => `${head}\nthumbnail: ${JSON.stringify(firstUrl)}${end}`);
      }
      changes.push({ path: post.path, content: src });
    }

    if (!changes.length) {
      return res.status(rateLimited ? 429 : 200).json({
        ok: !rateLimited, posts: 0, photos: 0,
        error: rateLimited ? '언스플래시 시간당 검색 한도에 걸렸어요. 1시간 뒤 다시 눌러주세요' : undefined,
      });
    }
    await commitFiles(`블로그 무료사진 채우기: 글 ${changes.length}개, 사진 ${placed}장`, changes);

    // 4) 언스플래시 규칙: 사용한 사진의 다운로드 알림 (실패해도 무시)
    const locations = [...usedPhotos.values()].filter(u => /^https:\/\/api\.unsplash\.com\/photos\//.test(u));
    const deadline = Date.now() + 15000;
    for (let i = 0; i < locations.length && Date.now() < deadline; i += 10) {
      const results = await Promise.allSettled(locations.slice(i, i + 10).map(u => unsplash(u.slice(API.length), key)));
      if (results.some(r => r.status === 'rejected' && r.reason && r.reason.rate)) break;
    }

    res.status(200).json({ ok: true, posts: changes.length, photos: placed, partial: rateLimited });
  } catch (e) {
    console.error('[admin/fill-photos]', e);
    res.status(500).json({ error: e.message });
  }
};
