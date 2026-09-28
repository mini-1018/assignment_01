# test1

Figma 시안을 Next.js + FSD 구조로 구현하고, Supabase 더미 데이터를 CSR로 조회해 화면에 보여준 뒤 GitHub와 Vercel로 배포하는 프로젝트다.

## 하네스: Next.js FSD 앱 구축

**목표:** 디자인 추출부터 배포까지를 역할이 나뉜 에이전트로 처리하고, 확장 가능한 FSD 구조를 유지한다.

**호출 조건:** 화면 구현, 피그마 시안 반영, 데이터 연결, 구조 변경, 배포와 관련된 작업을 요청받으면 `nextjs-fsd-app-orchestrator` 스킬을 사용한다. 재실행, 수정, 화면 추가 같은 후속 요청에도 같은 스킬을 쓴다. 단일 파일 수정이나 단순 질문에는 직접 답해도 된다.

**변경 이력:**

| 날짜 | 변경 내용 | 대상 | 사유 |
| --- | --- | --- | --- |
| 2026-09-28 | Harness v2로 처음 구성(에이전트 6, 스킬 6) | 전체 | - |
| 2026-09-28 | 화면 범위 규칙 추가(시안 기반 화면만 처리, 시안 외 화면은 보류) | nextjs-fsd-app-orchestrator, frontend-qa-check, figma-mcp-to-code | 원본 시안은 홈뿐이고 나머지 4개 화면은 반영 여부 미정 |
| 2026-09-28 | 테스트 규칙 추가(Vitest·MSW, 소유자별 테스트 작성, QA에 `npm test`·`.next` 캐시 제거 추가) | fsd-architecture(references/testing.md), supabase-csr-data, frontend-qa-check, nextjs-fsd-app-orchestrator | 테스트 도입. 라우트 제거 후 `.next` 캐시로 tsc가 실패하는 일이 두 번 반복됨 |
