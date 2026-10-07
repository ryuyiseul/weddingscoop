// 어드민 "모든 글 사진 채우기" 버튼
const { guard } = require('../_lib/admin');
const { fillAllPhotoSlots } = require('../_lib/fill-photos-core');

module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return res.status(503).json({ error: 'UNSPLASH_ACCESS_KEY가 설정되지 않았습니다', setup: true });
  try {
    const r = await fillAllPhotoSlots(key);
    res.status(r.ok ? 200 : 429).json(r);
  } catch (e) {
    console.error('[admin/fill-photos]', e);
    res.status(500).json({ error: e.message });
  }
};
