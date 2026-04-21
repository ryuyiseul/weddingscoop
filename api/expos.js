// Vercel Serverless Function - CORS 우회 프록시
// 호출 경로: /api/expos

module.exports = async (req, res) => {
  const targetUrl = 'https://cpaad.co.kr/api/ad_json_date.php';
  
  try {
    // Node.js 18+ 내장 fetch 사용 (또는 https 모듈 fallback)
    let data;
    let upstreamStatus;
    let upstreamText;
    
    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WeddingScoop/1.0)',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Encoding': 'gzip, deflate',
        },
        redirect: 'follow',
      });
      
      upstreamStatus = response.status;
      upstreamText = await response.text();
      
      if (!response.ok) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(502).json({
          error: 'Upstream returned non-OK status',
          upstreamStatus,
          upstreamBody: upstreamText.slice(0, 500),
        });
        return;
      }
      
      try {
        data = JSON.parse(upstreamText);
      } catch (parseErr) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(502).json({
          error: 'Failed to parse upstream JSON',
          upstreamStatus,
          upstreamBody: upstreamText.slice(0, 500),
          parseError: parseErr.message,
        });
        return;
      }
    } catch (fetchErr) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(502).json({
        error: 'Failed to fetch upstream',
        message: fetchErr.message || String(fetchErr),
        name: fetchErr.name,
        cause: fetchErr.cause ? String(fetchErr.cause) : undefined,
      });
      return;
    }
    
    // 성공
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json(data);
    
  } catch (err) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({
      error: 'Internal server error',
      message: err.message || String(err),
      stack: err.stack ? err.stack.split('\n').slice(0, 5) : undefined,
    });
  }
};
