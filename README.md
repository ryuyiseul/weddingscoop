# 웨딩스쿱 운영 가이드

## 📁 파일 구조

```
weddingscoop/
├── index.html      ← 메인 페이지 (건드릴 일 없음)
├── expos.json      ← 박람회 데이터 (이것만 수정)
├── posts/          ← 블로그 글 (.md 파일)
├── scripts/        ← 블로그 페이지 만드는 스크립트 (건드릴 일 없음)
└── vercel.json     ← Vercel 설정 (건드릴 일 없음)
```

---

## ➕ 신규 박람회 추가하는 법

`expos.json` 파일을 열어서 아래 형식으로 한 덩어리를 추가하면 됩니다.

```json
{
  "id": "seoul-coex-2026-08",
  "title": "2026 하반기 서울 웨딩박람회",
  "date": "2026-08-20",
  "endDate": "2026-08-22",
  "region": "서울",
  "location": "코엑스 D홀",
  "link": "https://replyalba.com/pt/여기에_리플라이알바_고유링크",
  "thumbnail": "https://이미지URL.jpg",
  "tag": "신규"
}
```

### 필드 설명

| 필드 | 필수 | 설명 |
|------|------|------|
| `id` | ✅ | 고유 식별자 (영문/숫자/하이픈, 중복 불가) |
| `title` | ✅ | 박람회 이름 |
| `date` | ✅ | 시작일 `YYYY-MM-DD` 형식 |
| `endDate` | ❌ | 종료일 (당일 행사면 생략) |
| `region` | ✅ | 지역명 — 필터 버튼에 자동 추가됨 (예: 서울, 부산, 인천, 대구, 광주, 대전, 제주) |
| `location` | ✅ | 정확한 장소 |
| `link` | ✅ | 리플라이알바에서 받은 본인 고유 링크 |
| `thumbnail` | ✅ | 썸네일 이미지 URL |
| `tag` | ❌ | 뱃지 문구 (예: 신규, 프리미엄, 얼리버드) — 비우면 뱃지 안 나옴 |

### 주의사항

- JSON 파일은 쉼표 위치가 민감합니다. 마지막 항목 뒤에는 쉼표를 붙이지 않습니다.
- 한 박람회를 삭제/수정할 때는 해당 덩어리 전체를 지우거나 수정하세요.
- `region` 값이 새로 추가되면 필터 버튼이 자동으로 만들어집니다.

---

## ✍️ 블로그 글 쓰는 법

블로그 주소: `weddingscoop.co.kr/blog`

글은 `posts` 폴더 안의 `.md` 파일 하나가 글 하나입니다. 저장(커밋)하면 Vercel이 1~2분 안에 자동으로 페이지를 만들어 줍니다.

1. GitHub 저장소 → `posts` 폴더 → `_template.md` 열어서 내용 복사
2. `posts` 폴더에서 `Add file` → `Create new file`
3. 파일 이름을 **영어 소문자·숫자·하이픈**으로 짓기 (예: `seoul-expo-tips.md`) → 이 이름이 주소가 됨 (`/blog/seoul-expo-tips`)
4. 복사한 견본을 붙여넣고 내용 수정 → `draft: true` 줄은 지우기 → `Commit changes`

맨 위 `---` 사이 정보:

| 항목 | 필수 | 설명 |
|------|------|------|
| `title` | ✅ | 글 제목 |
| `date` | ✅ | 작성일 `YYYY-MM-DD` — 날짜가 미래면 그날부터 공개됨 |
| `description` | ❌ | 목록·검색결과에 보이는 요약 (검색 노출에 중요) |
| `thumbnail` | ❌ | 대표 이미지 URL (목록 썸네일, 카톡 공유 미리보기) |
| `draft` | ❌ | `true`면 사이트에 안 올라감 (임시저장) |

본문 문법: `# 소제목`, `## 작은 소제목`, `**굵게**`, `[링크](주소)`, `![사진설명](이미지주소)`, `- 목록`, `1. 번호목록`, `> 강조박스`

- 글 삭제: 해당 `.md` 파일 삭제
- 글을 저장했는데 사이트가 안 바뀌면 Vercel 대시보드 → Deployments 에서 빌드 에러 메시지 확인 (제목/날짜 누락, 파일 이름 오류 등을 한국어로 알려줌)

### 🔎 네이버 검색 노출 (자동)

새 글을 올릴 때마다 따로 할 일은 없습니다. 아래 두 가지가 자동으로 처리됩니다.

1. **RSS (`/rss.xml`)** — 네이버가 주기적으로 확인해서 새 글을 가져감
2. **IndexNow 자동 알림** — 사이트 배포가 끝나면 GitHub가 네이버·빙에 "새 글이 생겼다"고 바로 알려줌 (최근 7일 안에 쓴 글 대상)
   - 결과 확인: GitHub 저장소 → `Actions` 탭 → `IndexNow`
   - 예전 글까지 한 번에 다시 알리고 싶으면: `Actions` → `IndexNow` → `Run workflow` → "모든 블로그 글 전송" 체크 → 실행
   - 루트의 `97bdbd41f083f6ae694f5b8899af430b.txt` 파일은 인증용이라 지우면 안 됨

**최초 1회만** 네이버 서치어드바이저(searchadvisor.naver.com) → 웹마스터 도구 → weddingscoop.co.kr 에서:
- `요청 → 사이트맵 제출`: `https://weddingscoop.co.kr/sitemap-blog.xml`
- `요청 → RSS 제출`: `https://weddingscoop.co.kr/rss.xml`

---

## 🚀 Vercel 배포 방법 (최초 1회)

### 1단계. GitHub 저장소 생성

1. github.com 로그인 → 우상단 `+` → `New repository`
2. 이름: `weddingscoop` (아무거나 OK)
3. Public/Private 상관없음 → Create

### 2단계. 파일 업로드

웹에서 바로 올려도 되고, 터미널로 올려도 됩니다. 웹으로 하는 법:

1. 만든 저장소에서 `uploading an existing file` 클릭
2. `index.html`, `expos.json`, `vercel.json` 세 개 드래그해서 업로드
3. `Commit changes`

### 3단계. Vercel 연결

1. vercel.com 가입 (GitHub 계정으로 로그인하면 편함)
2. `Add New...` → `Project`
3. 방금 만든 `weddingscoop` 저장소 `Import`
4. 설정 그대로 두고 `Deploy` 클릭
5. 30초쯤 기다리면 `xxx.vercel.app` 주소로 배포 완료

### 4단계. 도메인 연결 (weddingscoop.co.kr)

Vercel 프로젝트 안에서:

1. `Settings` → `Domains`
2. `weddingscoop.co.kr` 입력 → `Add`
3. Vercel이 알려주는 **A 레코드** 또는 **CNAME**을 도메인 관리페이지(가비아/후이즈 등)에 등록
4. 보통 5분~수시간 내 적용

   루트 도메인 연결 시:
   - Type: `A`
   - Host: `@`
   - Value: `76.76.21.21` (Vercel이 알려주는 값 그대로)

   `www.weddingscoop.co.kr`도 같이 쓰려면:
   - Type: `CNAME`
   - Host: `www`
   - Value: `cname.vercel-dns.com`

---

## 🔄 박람회 업데이트 워크플로 (최초 설정 이후)

### 방법 A. 웹에서 직접 수정 (제일 쉬움)

1. GitHub 저장소 → `expos.json` 클릭 → 연필 아이콘
2. 새 박람회 데이터 추가 또는 기존 데이터 수정
3. 하단 `Commit changes` 클릭
4. Vercel이 자동으로 감지해서 **1~2분 내 자동 재배포**
5. weddingscoop.co.kr 새로고침하면 반영됨

### 방법 B. 로컬에서 수정 (익숙해지면)

```bash
# expos.json 수정 후
git add expos.json
git commit -m "신규 박람회 추가"
git push
```

---

## 🎨 썸네일 이미지 팁

- **권장 비율**: 세로형 4:5 (카드가 세로 지향 디자인)
- **권장 해상도**: 800×1000px 이상
- **무료 이미지 소스**: Unsplash, Pexels
- **호스팅**: 이미지를 `/public` 폴더에 넣어도 되고, 박람회 공식 포스터 URL을 그대로 써도 됨
- 같은 박람회라도 분위기에 맞는 이미지를 골라야 클릭률이 올라감

---

## ❓ 자주 있는 문제

**Q. 수정했는데 사이트에 반영이 안 돼요**
→ 브라우저 강력 새로고침 (`Ctrl+Shift+R` / `Cmd+Shift+R`). `expos.json`은 5분간 캐시됩니다.

**Q. 필터에 새 지역이 안 나와요**
→ `expos.json`의 `region` 필드 오타 확인. 띄어쓰기/한자 모두 정확히 일치해야 같은 그룹으로 묶입니다.

**Q. 카드가 안 보여요**
→ JSON 문법 에러일 가능성 99%. jsonlint.com에 붙여넣어서 검증해보세요.
