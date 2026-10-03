// 어드민 글 관리 API
//   GET              글 목록 (임시저장 포함)
//   GET ?slug=xxx    글 하나 (본문 포함)
//   POST             저장 { originalSlug, meta, body, images: [{ path, base64 }] }  — 새 글 주소는 1, 2, 3… 자동
//   DELETE ?slug=xxx 삭제
const { guard, listDir, readFile, commitFiles, readJson } = require('../_lib/admin');
const { SLUG_RE, NUMERIC_SLUG_RE, DATE_RE, parsePost, serializePost, isDraft } = require('../../lib/post-format');

const IMAGE_PATH_RE = /^images\/blog\/[a-z0-9-]+\/[a-z0-9-]+\.(webp|jpg|jpeg|png|gif)$/;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const postPath = (slug) => `posts/${slug}.md`;

// 새 글 번호 = 지금 있는 숫자 주소 중 가장 큰 값 + 1
async function nextSlug() {
  const nums = (await listDir('posts'))
    .map(f => f.name.replace(/\.md$/, ''))
    .filter(n => NUMERIC_SLUG_RE.test(n))
    .map(Number);
  return String((nums.length ? Math.max(...nums) : 0) + 1);
}

const META_KEYS = ['title', 'seoTitle', 'keyword', 'date', 'description', 'thumbnail', 'draft'];
const pickMeta = (meta) => {
  const out = {};
  for (const k of META_KEYS) out[k] = k === 'draft' ? isDraft(meta) : String(meta[k] || '');
  return out;
};

function fail(res, status, error) {
  res.status(status).json({ error });
}

async function listPosts() {
  const files = (await listDir('posts')).filter(f => f.type === 'file' && f.name.endsWith('.md') && !f.name.startsWith('_'));
  const posts = await Promise.all(files.map(async (f) => {
    const slug = f.name.replace(/\.md$/, '');
    try {
      const { meta } = parsePost(await readFile(f.path), f.name);
      return { slug, ...pickMeta(meta), title: meta.title || '(제목 없음)' };
    } catch (e) {
      return { slug, title: `(형식 오류) ${f.name}`, date: '', draft: true, broken: true };
    }
  }));
  return posts.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (Number(b.slug) || 0) - (Number(a.slug) || 0));
}

async function getPost(slug) {
  const src = await readFile(postPath(slug));
  if (src === null) return null;
  const { meta, body } = parsePost(src, slug);
  return {
    slug,
    meta: pickMeta(meta),
    body,
  };
}

async function savePost(req, res) {
  const data = await readJson(req);
  const originalSlug = String(data.originalSlug || '').trim();
  // 사진만 먼저 올릴 때는 글 주소가 필요 없음
  let slug = originalSlug || 'new';
  const meta = data.meta || {};
  const images = Array.isArray(data.images) ? data.images : [];

  if (originalSlug && !SLUG_RE.test(originalSlug)) return fail(res, 400, '잘못된 글 주소입니다');
  if (!data.imagesOnly) {
    if (!String(meta.title || '').trim()) return fail(res, 400, '제목을 입력해주세요');
    if (!DATE_RE.test(meta.date || '')) return fail(res, 400, '날짜 형식이 올바르지 않습니다');
    if (!String(data.body || '').trim()) return fail(res, 400, '본문을 입력해주세요');
  }

  const files = [];
  for (const img of images) {
    if (!IMAGE_PATH_RE.test(img.path || '')) return fail(res, 400, '잘못된 이미지 경로입니다');
    if (!img.base64 || Buffer.byteLength(img.base64, 'base64') > MAX_IMAGE_BYTES) return fail(res, 400, '이미지가 너무 큽니다 (3MB 이하)');
    files.push({ path: img.path, base64: img.base64 });
  }

  // 사진이 많으면 화면에서 나눠 보냄: 사진만 먼저 저장
  if (data.imagesOnly) {
    if (!files.length) return fail(res, 400, '저장할 사진이 없습니다');
    await commitFiles(`블로그 사진 업로드 (${files.length}장)`, files);
    return res.status(200).json({ ok: true });
  }

  const isNew = !originalSlug;
  if (isNew) {
    slug = await nextSlug();
  } else if (await readFile(postPath(slug)) === null) {
    return fail(res, 404, '수정할 글을 찾을 수 없습니다 (이미 삭제됐을 수 있어요)');
  }

  files.push({ path: postPath(slug), content: serializePost(pickMeta(meta), data.body) });

  const title = String(meta.title).trim();
  await commitFiles(`블로그 ${isNew ? '새 글' : '수정'}: ${title}${meta.draft ? ' (임시저장)' : ''}`, files);
  res.status(200).json({ ok: true, slug });
}

async function deletePost(req, res, slug) {
  const post = await getPost(slug);
  if (!post) return fail(res, 404, '글을 찾을 수 없습니다');
  // 이 글이 쓰던 사진도 같이 삭제 (글 주소를 바꾼 적이 있어도 본문에 있는 사진은 지움)
  const used = new Set([...`${post.body}\n${post.meta.thumbnail}`.matchAll(/\/(images\/blog\/[a-z0-9-]+\/[a-z0-9-]+\.(?:webp|jpg|jpeg|png|gif))/g)].map(m => m[1]));
  (await listDir(`images/blog/${slug}`)).filter(f => f.type === 'file').forEach(f => used.add(f.path));
  const exists = await Promise.all([...used].map(async (p) => ((await readFile(p)) !== null ? p : null)));
  await commitFiles(`블로그 삭제: ${post.meta.title || slug}`, [
    { path: postPath(slug), delete: true },
    ...exists.filter(Boolean).map(p => ({ path: p, delete: true })),
  ]);
  res.status(200).json({ ok: true });
}

module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  const slug = String((req.query && req.query.slug) || '');
  try {
    if (req.method === 'GET') {
      if (!slug) return res.status(200).json({ posts: await listPosts() });
      if (!SLUG_RE.test(slug)) return fail(res, 400, '잘못된 글 주소입니다');
      const post = await getPost(slug);
      return post ? res.status(200).json(post) : fail(res, 404, '글을 찾을 수 없습니다');
    }
    if (req.method === 'POST') return await savePost(req, res);
    if (req.method === 'DELETE') {
      if (!SLUG_RE.test(slug)) return fail(res, 400, '잘못된 글 주소입니다');
      return await deletePost(req, res, slug);
    }
    fail(res, 405, 'Method not allowed');
  } catch (e) {
    console.error('[admin/posts]', e);
    const auth = e.status === 401 || e.status === 403;
    fail(res, 500, auth
      ? 'GitHub 토큰이 만료됐거나 권한이 없습니다. Vercel의 GITHUB_TOKEN을 확인해주세요'
      : `저장소 처리 중 오류가 발생했습니다 (${e.message.slice(0, 120)})`);
  }
};
