// 모든 글의 사진 자리 [[사진:검색어|설명]] 를 언스플래시 무료사진으로 채우는 공통 로직
// - 어드민 버튼(api/admin/fill-photos.js)과 배포 후 자동 실행(api/fill-photos-auto.js)이 같이 씀
// - 검색어마다 1번만 검색 (시간당 50번 한도), 글마다 서로 다른 사진, 커밋 1번
const { listDir, readFile, commitFiles } = require('./admin');
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

// 사진 설명·태그에 웨딩 관련 말이 있는 사진을 우선 사용
const WEDDING_WORDS = /wedding|bride|bridal|groom|marriage|married|ceremony|bouquet|ring|engag|couple|reception|veil|honeymoon|invitation|cake|vow/i;
const isWeddingPhoto = (p) => WEDDING_WORDS.test([p.alt_description, p.description, ...(p.tags || []).map(t => t.title)].filter(Boolean).join(' '));

async function inBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(...await Promise.all(items.slice(i, i + size).map(fn)));
  return out;
}

// 결과: { ok, posts, photos, partial, message?, error? }
async function fillAllPhotoSlots(key) {
  const started = Date.now();

  // 1) 사진 자리가 있는 글 모으기
  const files = (await listDir('posts')).filter(f => f.type === 'file' && f.name.endsWith('.md') && !f.name.startsWith('_'));
  const posts = (await inBatches(files, 8, async (f) => {
    const src = await readFile(f.path);
    const slots = findPhotoSlots(src);
    return slots.length ? { path: f.path, src, slots } : null;
  })).filter(Boolean);
  if (!posts.length) return { ok: true, posts: 0, photos: 0, message: '채울 사진 자리가 없어요' };

  // 2) 검색어마다 가로 사진 30장 (많이 쓰는 검색어는 60장)
  const uses = {};
  posts.forEach(p => p.slots.forEach(s => { uses[s.query] = (uses[s.query] || 0) + 1; }));
  const pools = {};
  let rateLimited = false;
  for (const q of Object.keys(uses)) {
    try {
      pools[q] = [];
      for (let page = 1; page <= (uses[q] > 30 ? 2 : 1); page++) {
        const data = await unsplash(`/search/photos?${new URLSearchParams({ query: q, page: String(page), per_page: '30', orientation: 'landscape', content_filter: 'high' })}`, key);
        pools[q].push(...(data.results || []));
      }
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
      const fresh = pool.filter(p => !inPost.has(p.id));
      const wedding = fresh.filter(isWeddingPhoto);
      const photo = (wedding.length ? wedding : fresh)
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
    return rateLimited
      ? { ok: false, posts: 0, photos: 0, partial: true, error: '언스플래시 시간당 검색 한도에 걸렸어요. 1시간 뒤 다시 시도해주세요' }
      : { ok: true, posts: 0, photos: 0, message: '찾은 사진이 없어요' };
  }
  await commitFiles(`블로그 무료사진 채우기: 글 ${changes.length}개, 사진 ${placed}장`, changes);

  // 4) 언스플래시 규칙: 사용한 사진의 다운로드 알림 (시간 남는 만큼, 실패해도 무시)
  const locations = [...usedPhotos.values()].filter(u => /^https:\/\/api\.unsplash\.com\/photos\//.test(u));
  const deadline = Math.min(Date.now() + 15000, started + 50000);
  for (let i = 0; i < locations.length && Date.now() < deadline; i += 10) {
    const results = await Promise.allSettled(locations.slice(i, i + 10).map(u => unsplash(u.slice(API.length), key)));
    if (results.some(r => r.status === 'rejected' && r.reason && r.reason.rate)) break;
  }

  return { ok: true, posts: changes.length, photos: placed, partial: rateLimited };
}

module.exports = { fillAllPhotoSlots };
