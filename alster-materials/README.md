# 알스터 수강생 자료실

수강생이 공통 비밀번호를 입력하면 자료(구글 드라이브 링크)를 받을 수 있는 사이트예요.

## 자료 추가·수정
`api/_materials.js` 만 고치면 돼요. 드라이브 "링크 복사" 주소를 `url` 에 붙여넣으세요.
드라이브 공유 설정은 "링크가 있는 모든 사용자 · 뷰어"로 해주세요.

## 비밀번호
Vercel 프로젝트 → Settings → Environment Variables 에 `STUDENT_PASSWORD` 를 추가해요.
바꾼 뒤에는 Deployments 에서 Redeploy 한 번 눌러야 적용돼요.
비밀번호를 바꾸면 "기억하기"로 저장해둔 수강생도 다시 입력해야 해요.
