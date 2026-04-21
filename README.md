# 웨딩스쿱 운영 가이드

## 📁 파일 구조

```
weddingscoop/
├── index.html      ← 메인 페이지 (건드릴 일 없음)
├── expos.json      ← 박람회 데이터 (이것만 수정)
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
