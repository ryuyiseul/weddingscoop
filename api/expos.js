// Vercel Serverless Function (Node.js)
// cpaad.co.kr API를 서버에서 대신 호출해서 CORS 우회
// 호출 경로: /api/expos

export default async function handler(req, res) {
  try {
    const response = await fetch('https://cpaad.co.kr/api/ad_json_date.php', {
      headers: {
        'User-Agent': 'WeddingScoop/1.0',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Upstream API error: ${response.status}`,
      });
    }

    const data = await response.json();

    // 브라우저에서 재요청할 때마다 최신 데이터 받도록 짧은 캐시
    // s-maxage=300: CDN은 5분간 캐시 (유저 로딩 빠르게)
    // stale-while-revalidate=600: 캐시 만료 후에도 10분간은 이전 데이터 쓰면서 백그라운드 갱신
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    return res.status(200).json(data);
  } catch (err) {
    console.error('[API Proxy Error]', err);
    return res.status(500).json({
      error: 'Failed to fetch from cpaad.co.kr',
      message: err.message,
    });
  }
}
