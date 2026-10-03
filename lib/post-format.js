// 블로그 글(.md) 파일 형식: 맨 위 --- 사이에 key: value, 그 아래 본문(마크다운)
// 블로그 빌드(scripts/build-blog.js)와 어드민 API(api/admin/*)가 같이 사용

const SLUG_RE = /^[a-z0-9-]+$/;
const NUMERIC_SLUG_RE = /^[1-9][0-9]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// seoTitle: 검색결과 제목(비우면 title), keyword: 포커스 키워드
const FIELDS = ['title', 'seoTitle', 'keyword', 'date', 'description', 'thumbnail', 'draft'];

function parseValue(raw) {
  const v = raw.trim();
  // 어드민이 저장한 값은 "..." (JSON 문자열) 형태
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    try { return JSON.parse(v); } catch (e) { /* 손으로 쓴 값이면 아래로 */ }
  }
  return v.replace(/^["']|["']$/g, '');
}

function parsePost(src, file = '') {
  const m = src.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: 맨 위에 --- 로 감싼 title/date 정보가 없습니다`);
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^\s*([A-Za-z]+)\s*:\s*(.*)$/);
    if (kv) meta[kv[1]] = parseValue(kv[2]);
  }
  return { meta, body: m[2] };
}

function serializePost(meta, body) {
  const oneLine = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim();
  const lines = ['---'];
  for (const key of FIELDS) {
    if (key === 'draft') {
      if (meta.draft) lines.push('draft: true');
    } else if (key === 'date') {
      lines.push(`date: ${meta.date}`);
    } else if (oneLine(meta[key])) {
      lines.push(`${key}: ${JSON.stringify(oneLine(meta[key]))}`);
    }
  }
  lines.push('---', '');
  return lines.join('\n') + String(body || '').replace(/\r\n/g, '\n').trim() + '\n';
}

const isDraft = (meta) => meta.draft === true || /^(true|yes)$/i.test(String(meta.draft || ''));

module.exports = { SLUG_RE, NUMERIC_SLUG_RE, DATE_RE, parsePost, serializePost, isDraft };
