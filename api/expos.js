// Vercel Serverless Function (CommonJS 방식)
// cpaad.co.kr API를 서버에서 대신 호출해서 CORS 우회
// 호출 경로: /api/expos

module.exports = async (req, res) => {
  try {
    const response = await fetch('https://cpaad.co.kr/api/ad_json_date.php', {
      headers: {
        'User-Agent': 'WeddingScoop/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      res.status(response.status).json({
        error: `Upstream API error: ${response.status}`,
      });
      return;
    }

    const data = await response.json();

    // CDN 캐시 5분 / 캐시 만료 후 10분간 stale 허용
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    res.status(200).json(data);
  } catch (err) {
    console.error('[API Proxy Error]', err);
    res.status(500).json({
      error: 'Failed to fetch from cpaad.co.kr',
      message: err.message || String(err),
    });
  }
};
