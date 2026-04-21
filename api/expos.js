// Vercel Serverless Function - 보안 강화 버전
// Referer/Origin 체크로 직접 접근 차단

module.exports = async (req, res) => {
  // ═══════ 1. 허용된 도메인 목록 ═══════
  const ALLOWED_HOSTS = [
    'weddingscoop.co.kr',
    'www.weddingscoop.co.kr',
    'weddingscoop.vercel.app',
  ];
  
  // Preview 배포(PR 미리보기) 패턴: weddingscoop-xxx.vercel.app
  const ALLOWED_HOST_PATTERN = /^weddingscoop-[\w-]+\.vercel\.app$/;
  
  // ═══════ 2. Referer/Origin 헤더에서 호스트 추출 ═══════
  const referer = req.headers.referer || req.headers.referrer || '';
  const origin = req.headers.origin || '';
  
  let sourceHost = '';
  try {
    if (origin) {
      sourceHost = new URL(origin).hostname;
    } else if (referer) {
      sourceHost = new URL(referer).hostname;
    }
  } catch (e) {
    sourceHost = '';
  }
  
  // ═══════ 3. 허용된 호스트인지 확인 ═══════
  const isAllowed = 
    ALLOWED_HOSTS.includes(sourceHost) ||
    ALLOWED_HOST_PATTERN.test(sourceHost);
  
  if (!isAllowed) {
    // 차단: 403 Forbidden
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  
  // ═══════ 4. CORS 헤더: 요청한 Origin만 허용 ═══════
  const allowedOrigin = origin && (ALLOWED_HOSTS.some(h => origin.includes(h)) || ALLOWED_HOST_PATTERN.test(new URL(origin).hostname))
    ? origin
    : 'https://weddingscoop.co.kr';
  
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Vary', 'Origin');
  
  // ═══════ 5. cpaad API 호출 ═══════
  const targetUrl = 'https://cpaad.co.kr/api/ad_json_date.php';
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      res.status(502).json({ error: 'Upstream error' });
      return;
    }
    
    const text = await response.text();
    const data = JSON.parse(text);
    
    // 캐시: CDN 10분 / 1시간 stale
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json(data);
    
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
