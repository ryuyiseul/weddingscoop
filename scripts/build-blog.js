// 블로그 빌드 스크립트
// posts/*.md  →  blog/index.html (목록), blog/<slug>.html (글), sitemap-blog.xml, rss.xml
// Vercel 배포 시 자동 실행됨 (vercel.json의 buildCommand). 로컬: node scripts/build-blog.js

const fs = require('fs');
const path = require('path');
const { SLUG_RE, DATE_RE, parsePost, isDraft } = require('../lib/post-format');

const ROOT = path.join(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'posts');
const OUT_DIR = path.join(ROOT, 'blog');
const SITE = 'https://weddingscoop.co.kr';
const DEFAULT_IMAGE = `${SITE}/og-image.png?v=2`;

// ═══════ 유틸 ═══════
const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// 한국 날짜 (Vercel 서버는 UTC라서 +9시간)
const todayKst = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

const formatDate = (d) => {
  const [y, m, day] = d.split('-').map(Number);
  return `${y}년 ${m}월 ${day}일`;
};

// ═══════ 마크다운 → HTML (marked) ═══════
let marked; // ESM 패키지라 build()에서 import

function setupMarked(m) {
  const external = (href) => /^https?:\/\//.test(href) && !href.startsWith(SITE);
  const linkAttrs = (href) => (external(href) ? ' target="_blank" rel="noopener"' : '');
  m.use({
    gfm: true,
    breaks: true, // 엔터 한 번 = 줄바꿈
    renderer: {
      // # → h2 (h1은 글 제목 하나만)
      heading({ tokens, depth }) {
        const level = Math.min(depth + 1, 6);
        return `<h${level}>${this.parser.parseInline(tokens)}</h${level}>\n`;
      },
      // 링크만 단독으로 있는 줄 → 버튼  예) [전국 웨딩박람회 일정 보러가기](/#campaigns)
      paragraph({ tokens }) {
        const meaningful = tokens.filter(t => !(t.type === 'text' && !t.raw.trim()) && t.type !== 'br');
        if (meaningful.length === 1 && meaningful[0].type === 'link') {
          const link = meaningful[0];
          const label = this.parser.parseInline(link.tokens).replace(/\s*(&gt;&gt;|»|→|▶)\s*$/, '');
          return `<p class="post-btn-wrap"><a class="post-btn" href="${escapeHtml(link.href)}"${linkAttrs(link.href)}>${label}<span class="post-btn-arrow" aria-hidden="true">▶</span></a></p>\n`;
        }
        return `<p>${this.parser.parseInline(tokens)}</p>\n`;
      },
      link({ href, title, tokens }) {
        return `<a href="${escapeHtml(href)}"${title ? ` title="${escapeHtml(title)}"` : ''}${linkAttrs(href)}>${this.parser.parseInline(tokens)}</a>`;
      },
      image({ href, title, text }) {
        return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"${title ? ` title="${escapeHtml(title)}"` : ''} loading="lazy" />`;
      },
    },
  });
}

const markdownToHtml = (md) => marked.parse(md);

// /images/... 같은 사이트 내부 경로 → https://weddingscoop.co.kr/images/... (카톡·네이버 미리보기용)
const absUrl = (u) => (u && u.startsWith('/') ? SITE + u : u);

// ═══════ 공통 레이아웃 ═══════
function layout({ title, description, url, image, type, jsonLd, body }) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="theme-color" content="#fefdfa" />
<script async src="https://www.googletagmanager.com/gtag/js?id=G-S1VEDRPBH2"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-S1VEDRPBH2', { 'send_page_view': true, 'anonymize_ip': true });
</script>
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<link rel="canonical" href="${url}" />
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%230a0a0a'/%3E%3Ctext x='16' y='23' font-family='Georgia, serif' font-size='22' font-weight='900' text-anchor='middle' fill='%23fefdfa'%3EW%3C/text%3E%3Ccircle cx='24' cy='9' r='3' fill='%23b8232f'/%3E%3C/svg%3E" />
<meta property="og:site_name" content="Wedding&amp;Scoop" />
<meta property="og:type" content="${type}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:locale" content="ko_KR" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="alternate" type="application/rss+xml" title="Wedding&amp;Scoop 웨딩 블로그" href="${SITE}/rss.xml" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,900&family=Inter:wght@400;600&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
<style>
  :root {
    --paper: #fefdfa; --paper-soft: #faf7f0; --ink: #0a0a0a; --ink-soft: #2a2a2a;
    --red: #b8232f; --red-deep: #8a1a24; --line: #ece9e0; --muted: #8a8680; --muted-dark: #5a5752;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { background: var(--paper); }
  body {
    background: var(--paper); color: var(--ink);
    font-family: 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing: antialiased; word-break: keep-all; overflow-wrap: break-word;
  }
  a { color: inherit; }
  .topbar {
    display: flex; justify-content: space-between; align-items: center; gap: 16px;
    padding: 14px 40px; background: var(--ink); color: var(--paper);
    font-family: 'Inter', sans-serif; font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase;
  }
  .topbar a { text-decoration: none; opacity: 0.75; }
  .topbar a:hover { opacity: 1; }
  .masthead { text-align: center; padding: 40px 20px 28px; border-bottom: 1px solid var(--line); }
  .brand {
    font-family: 'Fraunces', serif; font-weight: 900; font-size: clamp(28px, 4vw, 44px);
    letter-spacing: -0.045em; line-height: 1.05; text-decoration: none; color: var(--ink);
  }
  .brand .amp { font-style: italic; font-weight: 300; color: var(--red); }
  .masthead-sub {
    margin-top: 10px; font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 600;
    letter-spacing: 0.3em; text-transform: uppercase; color: var(--red);
  }
  main { max-width: 760px; margin: 0 auto; padding: 48px 20px 80px; }

  /* 목록 */
  .list-head h1 { font-size: clamp(26px, 4vw, 34px); font-weight: 800; letter-spacing: -0.03em; }
  .list-head p { margin-top: 8px; color: var(--muted-dark); font-size: 15px; }
  .post-list { list-style: none; margin-top: 32px; border-top: 2px solid var(--ink); }
  .post-item a {
    display: grid; grid-template-columns: 1fr 180px; gap: 24px; align-items: center;
    padding: 28px 0; border-bottom: 1px solid var(--line); text-decoration: none;
  }
  .post-item a:hover h2 { color: var(--red); }
  .post-item.no-thumb a { grid-template-columns: 1fr; }
  .post-item time, .post-meta time {
    font-family: 'Inter', 'Pretendard Variable', sans-serif; font-size: 12px; color: var(--muted);
    letter-spacing: 0.02em;
  }
  .post-item h2 { margin-top: 6px; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.4; transition: color 0.2s; }
  .post-item p { margin-top: 8px; font-size: 14.5px; line-height: 1.65; color: var(--muted-dark); }
  .post-item img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 6px; background: var(--paper-soft); }
  .empty { padding: 60px 0; text-align: center; color: var(--muted); }

  /* 글 */
  .back { display: inline-block; font-size: 13px; color: var(--muted-dark); text-decoration: none; margin-bottom: 28px; }
  .back:hover { color: var(--red); }
  .post-header h1 { font-size: clamp(26px, 4.5vw, 36px); font-weight: 800; letter-spacing: -0.03em; line-height: 1.35; }
  .post-meta { margin-top: 14px; padding-bottom: 28px; border-bottom: 1px solid var(--line); }
  .post-cover { margin-top: 32px; width: 100%; border-radius: 8px; display: block; }
  .post-body { margin-top: 32px; font-size: 17px; line-height: 1.85; color: var(--ink-soft); }
  .post-body > * + * { margin-top: 1.1em; }
  .post-body h2 { margin-top: 2em; font-size: 23px; line-height: 1.45; letter-spacing: -0.02em; color: var(--ink); }
  .post-body h3 { margin-top: 1.7em; font-size: 19px; line-height: 1.5; color: var(--ink); }
  .post-body h4 { margin-top: 1.5em; font-size: 17px; color: var(--ink); }
  .post-body ul, .post-body ol { padding-left: 1.3em; }
  .post-body li + li { margin-top: 0.4em; }
  .post-body a { color: var(--red); text-underline-offset: 3px; }
  .post-body .post-btn-wrap { margin-top: 1.6em; margin-bottom: 1.6em; text-align: center; }
  .post-body a.post-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 10px;
    min-width: 280px; max-width: 100%; padding: 16px 28px;
    background: var(--red); color: #fff; text-decoration: none;
    font-size: 16px; font-weight: 800; letter-spacing: -0.01em; line-height: 1.4;
    border-radius: 10px;
    box-shadow: 0 4px 0 var(--red-deep), 0 10px 22px -6px rgba(184, 35, 47, 0.45);
    transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.2s ease;
  }
  .post-body a.post-btn:hover { background: var(--red-deep); transform: translateY(-2px); }
  .post-body a.post-btn:active { transform: translateY(2px); box-shadow: 0 2px 0 var(--red-deep); }
  .post-body .post-btn-arrow { font-size: 12px; }
  .post-body strong { color: var(--ink); }
  .post-body img { max-width: 100%; height: auto; border-radius: 6px; display: block; }
  .post-body blockquote { border-left: 3px solid var(--red); background: var(--paper-soft); padding: 14px 18px; color: var(--muted-dark); }
  .post-body hr { border: none; border-top: 1px solid var(--line); margin: 2.2em 0; }
  .post-body table { width: 100%; border-collapse: collapse; font-size: 15px; display: block; overflow-x: auto; }
  .post-body th, .post-body td { border: 1px solid var(--line); padding: 10px 12px; text-align: left; vertical-align: top; }
  .post-body th { background: var(--paper-soft); color: var(--ink); font-weight: 700; }
  .post-body del { color: var(--muted); }
  .post-body code { background: var(--paper-soft); padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
  .post-body pre { background: var(--paper-soft); padding: 14px 16px; border-radius: 8px; overflow-x: auto; }
  .post-body pre code { background: none; padding: 0; }

  .cta {
    margin-top: 56px; padding: 32px 24px; text-align: center; background: var(--ink); color: var(--paper); border-radius: 10px;
  }
  .cta p { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
  .cta span { display: block; margin-top: 6px; font-size: 14px; opacity: 0.7; font-weight: 400; }
  .cta a {
    display: inline-block; margin-top: 18px; padding: 13px 26px; background: var(--red); color: #fff;
    font-weight: 700; font-size: 15px; border-radius: 8px; text-decoration: none;
  }
  .cta a:hover { background: var(--red-deep); }

  footer {
    background: var(--ink); color: rgba(255,255,255,0.55); padding: 28px 40px; font-family: 'Inter', sans-serif;
    font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  }
  footer a { color: inherit; text-decoration: none; }
  footer a:hover { color: var(--paper); }

  @media (max-width: 640px) {
    .topbar { padding: 10px 16px; font-size: 9px; letter-spacing: 0.15em; }
    .masthead { padding: 28px 16px 20px; }
    main { padding: 32px 16px 64px; }
    .post-item a { grid-template-columns: 1fr 96px; gap: 16px; padding: 22px 0; }
    .post-item h2 { font-size: 17px; }
    .post-item p { font-size: 13.5px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .post-body { font-size: 16px; }
    .post-body a.post-btn { display: flex; min-width: 0; width: 100%; padding: 15px 18px; font-size: 15px; }
    footer { padding: 24px 16px; }
  }
</style>
</head>
<body>
<div class="topbar">
  <a href="/">← 박람회 일정 보기</a>
  <a href="/blog">Blog</a>
</div>
<header class="masthead">
  <a class="brand" href="/">Wedding<span class="amp">&amp;</span>Scoop</a>
  <div class="masthead-sub">Wedding Journal</div>
</header>
<main>
${body}
</main>
<footer>
  <span>© ${new Date().getFullYear()} WEDDING&amp;SCOOP · ALL RIGHTS RESERVED</span>
  <span><a href="/">Home</a> · <a href="/blog">Blog</a></span>
</footer>
</body>
</html>
`;
}

const ctaBlock = `
<aside class="cta">
  <p>가까운 웨딩박람회, 무료초대권으로 다녀오세요<span>전국 박람회 일정을 한눈에 확인하고 사전신청 혜택을 받아보세요</span></p>
  <a href="/#campaigns">박람회 일정 보러가기 →</a>
</aside>`;

// ═══════ 빌드 ═══════
function loadPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const today = todayKst();
  return fs.readdirSync(POSTS_DIR)
    .filter(f => f.endsWith('.md') && !f.startsWith('_'))
    .map(file => {
      const slug = file.replace(/\.md$/, '');
      if (!SLUG_RE.test(slug)) throw new Error(`${file}: 파일 이름은 영어 소문자/숫자/하이픈(-)만 쓸 수 있습니다`);
      const { meta, body } = parsePost(fs.readFileSync(path.join(POSTS_DIR, file), 'utf8'), file);
      if (!meta.title) throw new Error(`${file}: title이 없습니다`);
      if (!DATE_RE.test(meta.date || '')) throw new Error(`${file}: date를 2026-10-03 형식으로 적어주세요`);
      return {
        slug,
        title: meta.title,
        date: meta.date,
        description: meta.description || '',
        thumbnail: meta.thumbnail || '',
        draft: isDraft(meta),
        body,
        html: markdownToHtml(body),
      };
    })
    // 임시저장(draft: true) 글과 날짜가 미래인 글은 공개하지 않음
    .filter(p => !p.draft && p.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

async function build() {
  marked = (await import('marked')).marked;
  setupMarked(marked);

  const posts = loadPosts();
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const p of posts) {
    const url = `${SITE}/blog/${p.slug}`;
    const body = `
<article>
  <a class="back" href="/blog">← 블로그 목록</a>
  <header class="post-header">
    <h1>${escapeHtml(p.title)}</h1>
    <div class="post-meta"><time datetime="${p.date}">${formatDate(p.date)}</time></div>
  </header>
  ${p.thumbnail && !p.body.includes(p.thumbnail) ? `<img class="post-cover" src="${escapeHtml(p.thumbnail)}" alt="${escapeHtml(p.title)}" />` : ''}
  <div class="post-body">
${p.html}
  </div>
</article>
${ctaBlock}`;
    fs.writeFileSync(path.join(OUT_DIR, `${p.slug}.html`), layout({
      title: `${p.title} | Wedding&Scoop`,
      description: p.description || p.title,
      url,
      image: absUrl(p.thumbnail) || DEFAULT_IMAGE,
      type: 'article',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: p.title,
        description: p.description || p.title,
        datePublished: p.date,
        image: absUrl(p.thumbnail) || DEFAULT_IMAGE,
        url,
        mainEntityOfPage: url,
        publisher: { '@type': 'Organization', name: 'Wedding&Scoop', url: SITE },
      },
      body,
    }));
  }

  const items = posts.map(p => `
  <li class="post-item${p.thumbnail ? '' : ' no-thumb'}">
    <a href="/blog/${p.slug}">
      <div>
        <time datetime="${p.date}">${formatDate(p.date)}</time>
        <h2>${escapeHtml(p.title)}</h2>
        ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ''}
      </div>
      ${p.thumbnail ? `<img src="${escapeHtml(p.thumbnail)}" alt="" loading="lazy" />` : ''}
    </a>
  </li>`).join('');

  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), layout({
    title: '웨딩 블로그 | 웨딩박람회·결혼준비 가이드 | Wedding&Scoop',
    description: '웨딩박람회 200% 활용법부터 결혼준비 체크리스트까지, 예비부부를 위한 웨딩 정보를 모았습니다.',
    url: `${SITE}/blog`,
    image: DEFAULT_IMAGE,
    type: 'website',
    body: `
<div class="list-head">
  <h1>웨딩 블로그</h1>
  <p>웨딩박람회 활용법부터 결혼준비 꿀팁까지, 예비부부를 위한 이야기</p>
</div>
${posts.length ? `<ul class="post-list">${items}\n</ul>` : '<div class="empty">아직 등록된 글이 없습니다.</div>'}
${ctaBlock}`,
  }));

  const urls = [
    { loc: `${SITE}/blog`, lastmod: posts[0]?.date },
    ...posts.map(p => ({ loc: `${SITE}/blog/${p.slug}`, lastmod: p.date })),
  ];
  fs.writeFileSync(path.join(ROOT, 'sitemap-blog.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>
`);

  // RSS (네이버 서치어드바이저에 한 번 제출해 두면 새 글을 자동으로 수집해 감)
  const toRfc822 = (d) => new Date(`${d}T09:00:00+09:00`).toUTCString();
  fs.writeFileSync(path.join(ROOT, 'rss.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Wedding&amp;Scoop 웨딩 블로그</title>
    <link>${SITE}/blog</link>
    <description>웨딩박람회 활용법부터 결혼준비 꿀팁까지, 예비부부를 위한 웨딩 정보</description>
    <language>ko</language>
    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />${posts[0] ? `\n    <lastBuildDate>${toRfc822(posts[0].date)}</lastBuildDate>` : ''}
${posts.map(p => `    <item>
      <title>${escapeHtml(p.title)}</title>
      <link>${SITE}/blog/${p.slug}</link>
      <guid isPermaLink="true">${SITE}/blog/${p.slug}</guid>
      <pubDate>${toRfc822(p.date)}</pubDate>
      <description>${escapeHtml(p.description || p.title)}</description>
    </item>`).join('\n')}
  </channel>
</rss>
`);

  console.log(`[blog] ${posts.length}개 글 빌드 완료 → /blog`);
}

build().catch((e) => { console.error(`[blog] 빌드 실패: ${e.message}`); process.exit(1); });
