const crypto = require("crypto");
const materials = require("./_materials");

// 구글 드라이브 파일 링크를 바로 다운로드 링크로 바꿔요. 폴더·문서 링크는 그대로 둬요.
function toDownloadUrl(url) {
  const m = /drive\.google\.com\/file\/d\/([\w-]+)/.exec(url || "");
  return m ? "https://drive.google.com/uc?export=download&id=" + m[1] : url;
}

function samePassword(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method" });
  }

  const expected = process.env.STUDENT_PASSWORD;
  if (!expected) return res.status(500).json({ error: "not_configured" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const password = String((body && body.password) || "").trim();

  if (!password || !samePassword(password, expected)) {
    // 틀리면 조금 늦게 답해서 마구 넣어보기 어렵게 해요.
    await new Promise((r) => setTimeout(r, 600));
    return res.status(401).json({ error: "wrong" });
  }

  const list = materials.map((group) => ({
    category: group.category,
    items: group.items.map((it) => ({
      title: it.title,
      desc: it.desc || "",
      type: it.type || "",
      isNew: !!it.isNew,
      url: it.url ? toDownloadUrl(it.url) : ""
    }))
  }));
  return res.status(200).json({ materials: list });
};
