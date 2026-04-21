// Vercel Serverless Function - CORS 우회 + 타임아웃 확장
module.exports = async (req, res) => {
  const targetUrl = 'https://cpaad.co.kr/api/ad_json_date.php';
  
  try {
    // AbortController로 25초 타임아웃 설정 (Vercel maxDuration 30초 이내)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    
    let data;
    
    try {
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
      
      const upstreamText = await response.text();
      
      if (!response.ok) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(502).json({
          error: 'Upstream returned non-OK status',
          upstreamStatus: response.status,
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
          upstreamStatus: response.status,
          upstreamBody: upstreamText.slice(0, 500),
        });
        return;
      }
    } catch (fetchErr) {
      clearTimeout(timeoutId);
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
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json(data);
    
  } catch (err) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({
      error: 'Internal server error',
      message: err.message || String(err),
    });
  }
};
