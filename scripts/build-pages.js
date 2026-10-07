// 메인 페이지 + 지역 페이지(/seoul, /busan …)를 검색로봇용으로 미리 만들어 둠
// - 박람회 목록은 원래 브라우저에서 불러와 그리기 때문에, 네이버 로봇이 보면 목록이 비어 있고
//   /seoul 도 메인과 똑같은 페이지(제목·주소)로 보였음
// - 빌드 때 받은 박람회 목록으로 카드·제목·설명·구조화 정보를 미리 채워 넣음
//   (방문자 브라우저에서는 기존처럼 최신 목록으로 다시 그림)
// scripts/build-blog.js 가 마지막에 불러서 실행

const fs = require('fs');
const path = require('path');
const LIVE = require('../lib/live-expos');

const SITE = 'https://weddingscoop.co.kr';
const ITEMS_PER_PAGE = 16; // index.html 과 같게

// 지역 페이지 (index.html 의 REGION_TO_SLUG 와 같게)
const REGIONS = [
  { region: '서울', slug: 'seoul', label: '서울', priority: '0.9' },
  { region: '경기도', slug: 'gyeonggi', label: '경기', priority: '0.9' },
  { region: '인천', slug: 'incheon', label: '인천', priority: '0.8' },
  { region: '부산', slug: 'busan', label: '부산', priority: '0.9' },
  { region: '충청', slug: 'chungcheong', label: '충청', priority: '0.8' },
  { region: '전라', slug: 'jeolla', label: '전라', priority: '0.8' },
  { region: '강원', slug: 'gangwon', label: '강원', priority: '0.8' },
  { region: '경상', slug: 'gyeongsang', label: '경상', priority: '0.8' },
  { region: '제주도', slug: 'jeju', label: '제주', priority: '0.8' },
  { region: '기타', slug: 'etc', label: '기타 지역', priority: '0.6' },
];

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const todayKst = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const korDate = (d) => { const [, m, day] = d.split('-').map(Number); return `${m}월 ${day}일`; };

function fmtRange(s, e) {
  const [, m, d] = s.split('-').map(Number);
  if (!e || e === s) return `${m}월 ${d}일`;
  const [, em, ed] = e.split('-').map(Number);
  return m === em ? `${m}월 ${d}일 - ${ed}일` : `${m}월 ${d}일 - ${em}월 ${ed}일`;
}

// index.html render() 의 카드와 같은 모양 (공유 버튼만 뺌 — 브라우저가 다시 그리면서 붙임)
function cardHtml(e) {
  return `
      <a class="card" href="${esc(e.link)}" target="_blank" rel="sponsored noopener">
        <div class="card-image">
          <img src="${esc(e.thumbnail)}" alt="${esc(e.title)} - ${esc(e.region)} 웨딩박람회·결혼박람회 무료초대권 신청" loading="lazy" />
        </div>
        <div class="card-body">
          <div class="card-badges"><span class="card-badge">${esc(e.region)}</span></div>
          <h3 class="card-title">${esc(e.title)}</h3>
          <div class="card-meta">
            <div class="card-meta-item"><span>📅 ${esc(fmtRange(e.date, e.endDate))}</span></div>
            ${e.location ? `<div class="card-meta-item"><span>📍 ${esc(e.location)}</span></div>` : ''}
          </div>
          <div class="card-cta-row">
            <div class="card-cta"><span class="card-cta-text">무료초대권 신청</span><span class="card-cta-arrow" aria-hidden="true">▶</span></div>
          </div>
        </div>
      </a>`;
}

// Event + ItemList 구조화 정보 (index.html updateEventSchema 와 같은 내용)
function eventListJson(expos, name) {
  const top = expos.slice()
    .sort((a, b) => (a.endDate || a.date).localeCompare(b.endDate || b.date))
    .slice(0, 10);
  if (!top.length) return '';
  const slugOf = (region) => (REGIONS.find(r => r.region === region) || {}).slug;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: top.length,
    itemListElement: top.map((e, i) => {
      const parts = String(e.address || '').split('||').map(s => s.trim()).filter(Boolean);
      return {
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Event',
          name: e.title,
          description: `${e.region} 웨딩박람회·결혼박람회 일정 - 무료초대권 신청 가능`,
          startDate: e.date,
          endDate: e.endDate || e.date,
          eventStatus: 'https://schema.org/EventScheduled',
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          ...(e.thumbnail ? { image: e.thumbnail } : {}),
          url: `${SITE}/${slugOf(e.region) || ''}`,
          location: {
            '@type': 'Place',
            name: parts[parts.length - 1] || e.location || e.title,
            address: { '@type': 'PostalAddress', streetAddress: parts[0] || '', addressLocality: e.region, addressCountry: 'KR' },
          },
          offers: {
            '@type': 'Offer', name: '무료초대권', price: '0', priceCurrency: 'KRW',
            availability: 'https://schema.org/InStock', url: e.link, validFrom: e.date,
          },
          organizer: { '@type': 'Organization', name: 'Wedding&Scoop', url: SITE },
        },
      };
    }),
  });
}

function breadcrumbJson(r) {
  const items = [{ '@type': 'ListItem', position: 1, name: '홈', item: `${SITE}/` }];
  if (r) {
    items.push({ '@type': 'ListItem', position: 2, name: '전국 웨딩박람회', item: `${SITE}/` });
    items.push({ '@type': 'ListItem', position: 3, name: `${r.label} 웨딩박람회`, item: `${SITE}/${r.slug}` });
  } else {
    items.push({ '@type': 'ListItem', position: 2, name: '전국 웨딩박람회', item: `${SITE}/` });
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items }, null, 2);
}

// id 로 찾은 태그의 속성값 바꾸기
function setAttr(html, id, attr, value) {
  const re = new RegExp(`(<[^>]*\\bid="${id}"[^>]*\\b${attr}=")[^"]*(")`);
  if (!re.test(html)) throw new Error(`index.html 에서 #${id} 를 못 찾음`);
  return html.replace(re, (m, a, b) => a + esc(value) + b);
}
const setScript = (html, id, json) =>
  html.replace(new RegExp(`(<script id="${id}" type="application/ld\\+json">)[\\s\\S]*?(</script>)`), (m, a, b) => `${a}${json ? `\n${json}\n` : ''}${b}`);
const setBetween = (html, name, inner) =>
  html.replace(new RegExp(`(<!-- ${name}:START[^>]*-->)[\\s\\S]*?(<!-- ${name}:END -->)`), (m, a, b) => a + inner + b);

function fillPage(html, expos, r, guides) {
  // 브라우저와 같은 순서(cpaad 등록순) 첫 페이지
  const list = expos.slice().sort((a, b) => a.order - b.order);
  const cards = list.slice(0, ITEMS_PER_PAGE).map(cardHtml).join('');
  html = setBetween(html, 'GRID', cards ? `${cards}\n      ` : '');
  html = html.replace(/(<strong id="countNum">)[^<]*(<\/strong>)/, (m, a, b) => a + String(expos.length).padStart(2, '0') + b);
  html = setScript(html, 'eventListJsonLd', eventListJson(expos, r ? `${r.label} 웨딩박람회 목록` : '전국 웨딩박람회 목록'));
  if (!r) return html;

  const n = expos.length;
  const url = `${SITE}/${r.slug}`;
  const title = `${r.label} 웨딩박람회 일정·무료초대권 신청${n ? ` (${n}개)` : ''} | Wedding&Scoop`;
  const desc = `${r.label} 웨딩박람회·결혼박람회${n ? ` ${n}개` : ''} 일정과 무료초대권 신청. ${korDate(todayKst())} 기준 실시간 정리, 매일 업데이트.`;

  html = html.replace(/(<title id="pageTitle">)[^<]*(<\/title>)/, (m, a, b) => a + esc(title) + b);
  html = setAttr(html, 'metaDescription', 'content', desc);
  html = setAttr(html, 'canonicalLink', 'href', url);
  html = setAttr(html, 'ogTitle', 'content', title);
  html = setAttr(html, 'ogDescription', 'content', desc);
  html = setAttr(html, 'ogUrl', 'content', url);
  html = setAttr(html, 'twTitle', 'content', title);
  html = setAttr(html, 'twDescription', 'content', desc);
  html = html.replace(/(<link rel="alternate" hreflang="(?:ko-KR|x-default)" href=")[^"]*(")/g, (m, a, b) => a + url + b);
  html = setScript(html, 'breadcrumbJsonLd', breadcrumbJson(r));

  // 지역 소개 + 이 권역의 지역별 가이드 글 링크
  const intro = n
    ? `지금 신청할 수 있는 <strong>${esc(r.label)} 웨딩박람회</strong>는 ${n}개예요 (${korDate(todayKst())} 기준). 일정·장소를 확인하고 무료초대권을 미리 신청하세요.`
    : `지금은 신청 가능한 ${esc(r.label)} 웨딩박람회가 없어요. 가까운 지역 일정과 아래 가이드를 확인해 보세요.`;
  const chips = guides.length
    ? `\n    <div class="seo-regions-keywords">\n${guides.map(p => `      <a href="/blog/${p.slug}">${esc(p.keyword || p.title)}</a>`).join('\n')}\n    </div>`
    : '';
  html = setBetween(html, 'REGION_INTRO', `
<section class="region-intro" aria-label="${esc(r.label)} 웨딩박람회 안내">
  <div class="region-intro-inner">
    <h2 class="region-intro-title">${esc(r.label)} 웨딩박람회·결혼박람회 일정</h2>
    <p class="region-intro-desc">${intro}</p>${chips ? `\n    <h3 class="region-intro-sub">${esc(r.label)} 지역별 웨딩박람회 가이드</h3>${chips}` : ''}
  </div>
</section>
`);
  return html;
}

function buildPages({ root, expos, posts }) {
  const HOME = path.join(root, 'index.html');
  const src = fs.readFileSync(HOME, 'utf8');
  for (const name of ['GRID', 'REGION_INTRO']) {
    if (!src.includes(`<!-- ${name}:START`)) throw new Error(`index.html 에 ${name} 표시가 없음`);
  }
  const all = expos || [];

  // 메인: 박람회 카드만 미리 채움 (박람회를 못 불러왔으면 비워 둠)
  const home = fillPage(src, all, null, []);
  if (home !== src) fs.writeFileSync(HOME, home);

  // 지역 페이지: <slug>.html (cleanUrls 로 /seoul 주소가 됨)
  for (const r of REGIONS) {
    const guides = posts
      .filter(p => p.place && LIVE.regionOf(p.place) === r.region)
      .sort((a, b) => (Number(a.slug) || 0) - (Number(b.slug) || 0));
    fs.writeFileSync(path.join(root, `${r.slug}.html`), fillPage(home, all.filter(e => e.region === r.region), r, guides));
  }

  // 메인 사이트맵 (메인 + 지역 페이지, 매 빌드 날짜로)
  const today = todayKst();
  const urls = [{ loc: `${SITE}/`, priority: '1.0' }, ...REGIONS.map(r => ({ loc: `${SITE}/${r.slug}`, priority: r.priority }))];
  fs.writeFileSync(path.join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`);
  console.log(`[pages] 메인 + 지역 페이지 ${REGIONS.length}개 (박람회 ${all.length}개 미리 넣음)`);
}

module.exports = { buildPages, REGIONS };
