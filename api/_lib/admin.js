// 어드민 공통: 환경변수, 로그인 세션, GitHub 저장
//
// Vercel → Settings → Environment Variables 에 필요한 값
//   ADMIN_PASSWORD  어드민 로그인 비밀번호
//   ADMIN_URL_KEY   어드민 주소 열쇠 (weddingscoop.co.kr/admin/<이 값>)
//   GITHUB_TOKEN    글을 저장할 GitHub 토큰 (이 저장소 Contents 읽기/쓰기 권한)

const crypto = require('crypto');

const REPO = process.env.GITHUB_REPO || 'ryuyiseul/weddingscoop';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const COOKIE = 'ws_admin';
const SESSION_DAYS = 7;

function config() {
  const { ADMIN_PASSWORD, ADMIN_URL_KEY, GITHUB_TOKEN } = process.env;
  const missing = Object.entries({ ADMIN_PASSWORD, ADMIN_URL_KEY, GITHUB_TOKEN })
    .filter(([, v]) => !v).map(([k]) => k);
  return { ADMIN_PASSWORD, ADMIN_URL_KEY, GITHUB_TOKEN, missing };
}

const safeEqual = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

// 비밀번호/토큰이 바뀌면 기존 로그인은 자동으로 풀림
const sessionKey = () => {
  const { ADMIN_PASSWORD, GITHUB_TOKEN } = config();
  return crypto.createHash('sha256').update(`ws-admin|${ADMIN_PASSWORD}|${GITHUB_TOKEN}`).digest();
};
const sign = (data) => crypto.createHmac('sha256', sessionKey()).update(data).digest('base64url');

function createSessionCookie() {
  const exp = Date.now() + SESSION_DAYS * 86400000;
  const data = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  return `${COOKIE}=${data}.${sign(data)}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`;
}
const clearSessionCookie = () => `${COOKIE}=; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

function isLoggedIn(req) {
  if (config().missing.length) return false;
  const raw = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(`${COOKIE}=`));
  if (!raw) return false;
  const [data, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!data || !sig || !safeEqual(sig, sign(data))) return false;
  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString()).exp > Date.now();
  } catch (e) {
    return false;
  }
}

// 모든 어드민 API 앞단: 로그인 + 다른 사이트에서의 요청 차단
function guard(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'GET' && req.headers['x-admin-request'] !== '1') {
    res.status(403).json({ error: '잘못된 요청입니다' });
    return false;
  }
  if (!isLoggedIn(req)) {
    res.status(401).json({ error: '로그인이 필요합니다' });
    return false;
  }
  return true;
}

// ═══════ GitHub API ═══════
async function gh(path, options = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config().GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'weddingscoop-admin',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (res.status === 404 && options.allow404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`GitHub ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

// 폴더 안 파일 목록 (없으면 빈 배열)
async function listDir(dir) {
  const items = await gh(`/contents/${dir}?ref=${BRANCH}`, { allow404: true });
  return Array.isArray(items) ? items : [];
}

async function readFile(filePath) {
  const item = await gh(`/contents/${filePath}?ref=${BRANCH}`, { allow404: true });
  if (!item || item.type !== 'file') return null;
  return Buffer.from(item.content, 'base64').toString('utf8');
}

// 여러 파일 추가/수정/삭제를 커밋 하나로 (→ Vercel 배포 1번)
// files: [{ path, content (utf8 문자열) | base64 | delete: true }]
async function commitFiles(message, files) {
  const ref = await gh(`/git/ref/heads/${BRANCH}`);
  const headSha = ref.object.sha;
  const head = await gh(`/git/commits/${headSha}`);

  // 파일 내용 올리기 (8개씩 동시에)
  const tree = [];
  for (let i = 0; i < files.length; i += 8) {
    tree.push(...await Promise.all(files.slice(i, i + 8).map(async (f) => {
      if (f.delete) return { path: f.path, mode: '100644', type: 'blob', sha: null };
      const blob = await gh('/git/blobs', {
        method: 'POST',
        body: JSON.stringify(f.base64 !== undefined
          ? { content: f.base64, encoding: 'base64' }
          : { content: f.content, encoding: 'utf-8' }),
      });
      return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
    })));
  }

  const newTree = await gh('/git/trees', {
    method: 'POST',
    body: JSON.stringify({ base_tree: head.tree.sha, tree }),
  });
  const commit = await gh('/git/commits', {
    method: 'POST',
    body: JSON.stringify({ message, tree: newTree.sha, parents: [headSha] }),
  });
  await gh(`/git/refs/heads/${BRANCH}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha }),
  });
  return commit.sha;
}

// Vercel 함수 요청 본문(JSON) 읽기
async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

module.exports = {
  config, safeEqual, createSessionCookie, clearSessionCookie, isLoggedIn, guard,
  listDir, readFile, commitFiles, readJson,
};
