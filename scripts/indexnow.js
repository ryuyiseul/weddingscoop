// IndexNow: 배포가 끝나면 네이버·빙에 "이 페이지들이 새로 생겼거나 바뀌었다"고 알림
// GitHub Actions(.github/workflows/indexnow.yml)가 Vercel 운영 배포 성공 후 자동 실행
// 수동 실행: node scripts/indexnow.js   (모든 블로그 글 전송: node scripts/indexnow.js --all)

const SITE = 'https://weddingscoop.co.kr';
const KEY = '97bdbd41f083f6ae694f5b8899af430b'; // 사이트 루트의 97bdbd41f083f6ae694f5b8899af430b.txt 와 같아야 함
const RECENT_DAYS = 7; // 최근 N일 안에 작성된 글만 알림 (--all 이면 전부)

const ENDPOINTS = [
  'https://searchadvisor.naver.com/indexnow',
  'https://api.indexnow.org/indexnow', // 빙 등 IndexNow 참여 검색엔진
];

async function main() {
  const all = process.argv.includes('--all');
  const res = await fetch(`${SITE}/sitemap-blog.xml`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`sitemap-blog.xml 불러오기 실패: HTTP ${res.status}`);
  const xml = await res.text();

  const cutoff = new Date(Date.now() - RECENT_DAYS * 86400000).toISOString().slice(0, 10);
  const entries = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)]
    .map(m => ({ loc: m[1].trim(), lastmod: (m[2] || '').trim() }));
  const urls = entries
    .filter(e => all || e.loc === `${SITE}/blog` || (e.lastmod && e.lastmod >= cutoff))
    .map(e => e.loc);

  // 메인·지역 페이지는 박람회 목록이 매일 바뀌므로 매번 알림
  const main = await fetch(`${SITE}/sitemap.xml`, { cache: 'no-store' }).then(r => (r.ok ? r.text() : '')).catch(() => '');
  for (const m of main.matchAll(/<loc>([^<]+)<\/loc>/g)) if (!urls.includes(m[1].trim())) urls.push(m[1].trim());

  if (!urls.length) { console.log('[IndexNow] 알릴 페이지 없음'); return; }
  console.log(`[IndexNow] ${urls.length}개 URL 전송:\n  ${urls.join('\n  ')}`);

  const body = JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls });
  let ok = 0;
  for (const endpoint of ENDPOINTS) {
    try {
      const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body });
      console.log(`[IndexNow] ${endpoint} → HTTP ${r.status}`);
      if (r.status >= 200 && r.status < 300) ok++;
    } catch (e) {
      console.log(`[IndexNow] ${endpoint} → 실패: ${e.message}`);
    }
  }
  if (!ok) process.exit(1);
}

main().catch(e => { console.error(e.message); process.exit(1); });
