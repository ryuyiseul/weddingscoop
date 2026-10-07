// GitHub Actions 신원 증명 토큰(OIDC) 확인
// 워크플로가 GitHub에서 발급받은 토큰을 보내면, GitHub 공개키로 서명을 확인해
// "이 저장소(ryuyiseul/weddingscoop)의 GitHub Actions에서 온 요청"인지 판단 — 따로 비밀값이 필요 없음
const crypto = require('crypto');

const ISSUER = 'https://token.actions.githubusercontent.com';
const JWKS_URL = `${ISSUER}/.well-known/jwks`;
let jwksCache = { at: 0, keys: [] };

async function getKeys(force) {
  if (!force && jwksCache.keys.length && Date.now() - jwksCache.at < 3600000) return jwksCache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`JWKS ${res.status}`);
  jwksCache = { at: Date.now(), keys: (await res.json()).keys || [] };
  return jwksCache.keys;
}

const b64json = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

// 맞으면 토큰 내용(claims), 아니면 null
async function verifyGithubOidc(authHeader, { audience, repository }) {
  const m = String(authHeader || '').match(/^Bearer\s+([\w-]+)\.([\w-]+)\.([\w-]+)$/);
  if (!m) return null;
  let header;
  let claims;
  try {
    header = b64json(m[1]);
    claims = b64json(m[2]);
  } catch (e) {
    return null;
  }
  if (header.alg !== 'RS256' || !header.kid) return null;
  let jwk = (await getKeys(false)).find(k => k.kid === header.kid);
  if (!jwk) jwk = (await getKeys(true)).find(k => k.kid === header.kid); // 키가 바뀐 경우
  if (!jwk) return null;
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${m[1]}.${m[2]}`), crypto.createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(m[3], 'base64url'));
  if (!ok) return null;
  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== ISSUER || !aud.includes(audience) || !(claims.exp > now) || (claims.nbf && claims.nbf > now + 60)) return null;
  if (String(claims.repository || '').toLowerCase() !== repository.toLowerCase()) return null;
  return claims;
}

module.exports = { verifyGithubOidc };
