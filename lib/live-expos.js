// 블로그 글 속 "실시간 박람회 목록" — 본문에 [[박람회:서울]] 한 줄을 쓰면 그 자리에 들어감
// 같은 파일을 두 곳에서 씀:
//  - 블로그 빌드(Node): 배포 시점 목록을 HTML로 미리 넣음 → 네이버 검색로봇이 읽을 수 있음
//  - 방문자 브라우저: 페이지를 열면 /api/expos 로 최신 목록을 다시 받아 바꿔 끼움
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WSLiveExpos = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const PARTNER_ID = 'popo9110';
  const MAX_CARDS = 6;

  // cpaad region 코드 → 사이트 지역 이름 (메인 페이지와 같음)
  const REGION_MAP = {
    capital: '서울', gyeonggi: '경기도', incheon: '인천', chungcheong: '충청', jeolla: '전라',
    gangwon: '강원', gyeongsang: '경상', busan: '부산', jeju: '제주도', etc: '기타',
  };
  // 메인 페이지 지역 주소 (전체 일정 보기 링크)
  const REGION_PATH = {
    서울: '/seoul', 경기도: '/gyeonggi', 인천: '/incheon', 충청: '/chungcheong', 전라: '/jeolla',
    강원: '/gangwon', 경상: '/gyeongsang', 부산: '/busan', 제주도: '/jeju', 기타: '/etc',
  };
  // [[박람회:○○]] 에 쓸 수 있는 지역 이름
  const REGION_ALIAS = {
    서울: '서울', 경기: '경기도', 경기도: '경기도', 인천: '인천', 충청: '충청', 충청도: '충청', 전라: '전라', 전라도: '전라',
    강원: '강원', 강원도: '강원', 경상: '경상', 경상도: '경상', 부산: '부산', 제주: '제주도', 제주도: '제주도',
  };
  // 도시 → 주소에서 찾을 말, 박람회가 없을 때 대신 보여줄 지역
  const CITY = {
    강남: { find: ['강남구', '서초구'], region: '서울' },
    코엑스: { find: ['코엑스', 'COEX', '영동대로 513'], region: '서울' },
    세텍: { find: ['세텍', 'SETEC', '남부순환로 3104'], region: '서울' },
    일산: { find: ['일산', '고양'], region: '경기도' },
    고양: { find: ['고양', '일산'], region: '경기도' },
    분당: { find: ['분당', '성남'], region: '경기도' },
    성남: { find: ['성남', '분당'], region: '경기도' },
    동탄: { find: ['동탄', '화성'], region: '경기도' },
    화성: { find: ['화성', '동탄'], region: '경기도' },
    송도: { find: ['송도', '연수구'], region: '인천' },
    대전: { find: ['대전'], region: '충청' },
    세종: { find: ['세종'], region: '충청' },
    대구: { find: ['대구'], region: '경상' },
    울산: { find: ['울산'], region: '경상' },
    광주: { find: ['광주광역시', '광주 '], region: '전라' },
  };
  ['수원', '용인', '부천', '안양', '안산', '평택', '의정부', '김포', '광명', '시흥', '파주', '군포', '하남'].forEach(c => { CITY[c] = { find: [c], region: '경기도' }; });
  ['청주', '천안', '아산', '충주'].forEach(c => { CITY[c] = { find: [c], region: '충청' }; });
  ['전주', '익산', '군산', '여수', '목포', '순천'].forEach(c => { CITY[c] = { find: [c], region: '전라' }; });
  ['창원', '진주', '김해', '포항', '경주', '구미', '양산'].forEach(c => { CITY[c] = { find: [c], region: '경상' }; });
  ['춘천', '원주', '강릉', '속초', '동해'].forEach(c => { CITY[c] = { find: [c], region: '강원' }; });

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function normDate(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    const m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null;
  }
  function promoUrl(adUrl) {
    if (!adUrl) return '';
    let s = String(adUrl).trim();
    if (s.endsWith('/' + PARTNER_ID) || s.endsWith('/' + PARTNER_ID + '/')) return s;
    if (!s.endsWith('/')) s += '/';
    return s + PARTNER_ID;
  }
  function venue(raw) {
    const parts = String(raw || '').split('||').map(s => s.trim()).filter(Boolean);
    if (!parts.length) return '';
    return parts.length >= 3 ? parts[parts.length - 1] : parts[0];
  }
  const todayKst = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

  // API 응답 → 진행 중·예정 박람회 목록 (마감 임박 순)
  function normalize(data) {
    const ads = (data && data.advertisements) || {};
    const today = todayKst();
    return Object.entries(ads).map(([id, raw], i) => ({
      id,
      order: i,
      title: raw.gather_name || '',
      date: normDate(raw.start_date),
      endDate: normDate(raw.end_date),
      link: promoUrl(raw.ad_url),
      region: REGION_MAP[String(raw.region || '').trim().toLowerCase()] || '기타',
      location: venue(raw.ad_location),
      address: raw.ad_location || '',
      thumbnail: raw.ad_thumbnail || raw.ad_mainvisual || '',
    }))
      .filter(e => e.title && e.date && e.link && (e.endDate || e.date) >= today)
      .sort((a, b) => (a.endDate || a.date).localeCompare(b.endDate || b.date) || a.order - b.order);
  }

  // [[박람회:대전]] → 대전 박람회, 없으면 충청 박람회
  function pick(expos, place) {
    const key = String(place || '').trim();
    const region = REGION_ALIAS[key];
    if (region) return { items: expos.filter(e => e.region === region), region, fallback: false };
    const city = CITY[key] || { find: [key], region: null };
    const hit = expos.filter(e => city.find.some(w => (e.address + ' ' + e.location + ' ' + e.title).includes(w)));
    if (hit.length || !city.region) return { items: hit, region: city.region, fallback: false };
    return { items: expos.filter(e => e.region === city.region), region: city.region, fallback: true };
  }

  function fmtRange(s, e) {
    const f = (d) => { const [, m, day] = d.split('-').map(Number); return `${m}.${day}`; };
    const wd = (d) => '일월화수목금토'[new Date(d + 'T00:00:00+09:00').getUTCDay()];
    if (!s) return '';
    return !e || e === s ? `${f(s)}(${wd(s)})` : `${f(s)}(${wd(s)}) ~ ${f(e)}(${wd(e)})`;
  }
  function fmtToday() {
    const [y, m, d] = todayKst().split('-').map(Number);
    return `${y}년 ${m}월 ${d}일`;
  }

  // 목록 HTML (빌드와 브라우저가 똑같이 씀)
  function renderInner(expos, place, opts) {
    const o = opts || {};
    const { items, region, fallback } = pick(expos, place);
    const shown = items.slice(0, MAX_CARDS);
    const regionName = region === '제주도' ? '제주' : region === '경기도' ? '경기' : region;
    const note = fallback
      ? `<p class="live-expos-note">지금은 ${esc(place)}에서 열리는 박람회가 없어 가까운 ${esc(regionName)} 지역 박람회를 보여드려요.</p>` : '';
    const cards = shown.map(e => `
      <a class="live-card" href="${esc(e.link)}" target="_blank" rel="sponsored noopener" data-expo="${esc(e.title)}">
        <span class="live-card-img">${e.thumbnail ? `<img src="${esc(e.thumbnail)}" alt="${esc(e.title)} - ${esc(place)} 웨딩박람회 무료초대권" loading="lazy" />` : ''}</span>
        <span class="live-card-body">
          <span class="live-card-badge">${esc(e.region === '제주도' ? '제주' : e.region)}</span>
          <strong class="live-card-title">${esc(e.title)}</strong>
          <span class="live-card-meta">📅 ${esc(fmtRange(e.date, e.endDate))}</span>
          ${e.location ? `<span class="live-card-meta">📍 ${esc(e.location)}</span>` : ''}
          <span class="live-card-cta">무료초대권 신청 ▶</span>
        </span>
      </a>`).join('');
    const empty = `<p class="live-expos-empty">지금 신청 가능한 박람회를 불러오는 중이에요. <a href="/">전국 박람회 일정 보기 →</a></p>`;
    const more = REGION_PATH[region]
      ? `<a class="live-expos-more" href="${REGION_PATH[region]}">${esc(regionName)} 박람회 전체 일정 보기 →</a>`
      : '<a class="live-expos-more" href="/">전국 박람회 전체 일정 보기 →</a>';
    return `${note}${shown.length ? `<div class="live-expos-grid">${cards}</div>` : empty}
      <div class="live-expos-foot"><span class="live-expos-time">${o.live ? '방금 업데이트됨' : `${fmtToday()} 기준`} · 매일 자동 업데이트</span>${more}</div>`;
  }

  function renderBlock(expos, place) {
    return `<section class="live-expos" data-place="${esc(place)}">
  <div class="live-expos-head"><span class="live-expos-dot" aria-hidden="true"></span><h3 class="live-expos-title">지금 신청 가능한 ${esc(place)} 웨딩박람회</h3></div>
  <div class="live-expos-inner">${renderInner(expos || [], place, {})}</div>
</section>\n`;
  }

  // 브라우저: 최신 목록으로 바꿔 끼우기
  function hydrate() {
    const blocks = document.querySelectorAll('.live-expos[data-place]');
    if (!blocks.length) return;
    fetch('/api/expos', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(data => {
        const expos = normalize(data);
        blocks.forEach(b => {
          b.querySelector('.live-expos-inner').innerHTML = renderInner(expos, b.dataset.place, { live: true });
        });
      })
      .catch(() => { /* 실패하면 미리 넣어둔 목록 그대로 */ });
    document.addEventListener('click', (ev) => {
      const a = ev.target.closest && ev.target.closest('.live-card');
      if (a && typeof window.gtag === 'function') {
        window.gtag('event', 'expo_card_click', { expo_title: a.dataset.expo, source: 'blog', page_path: location.pathname });
      }
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hydrate);
    else hydrate();
  }

  // [[박람회:○○]] 의 지역(권역) 이름
  const regionOf = (place) => {
    const key = String(place || '').trim();
    return REGION_ALIAS[key] || (CITY[key] && CITY[key].region) || null;
  };

  return { normalize, renderBlock, regionOf, MARKER: /^\[\[박람회:([^\]]+)\]\]$/ };
});
