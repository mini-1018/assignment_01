# 테스트 작성 규칙

Vitest + jsdom + Testing Library + MSW를 쓴다. `npm test`로 한 번 실행하고, `npm run test:watch`로 파일이 바뀔 때마다 다시 실행한다.

## 왜 이렇게 테스트하는가

이 앱에서 결함은 주로 두 곳에서 생긴다. 훅이 Supabase로 보내는 요청(컬럼, 필터, 이스케이프)과 화면의 상태 분기(로딩·빈·오류·이전 결과)다. 두 곳 모두 빌드와 타입 검사를 통과한 채로 틀릴 수 있다.

그래서 supabase 클라이언트를 모킹하지 않는다. MSW로 HTTP 요청을 가로채면 실제 supabase-js가 만든 URL을 단언할 수 있다. 클라이언트를 모킹하면 `.ilike()`를 호출했다는 사실만 확인하고, 실제로 어떤 값이 전송되는지는 확인하지 못한다.

## 배치

| 위치 | 내용 | 소유 |
| --- | --- | --- |
| 소스 옆 `*.test.ts(x)` | 해당 모듈의 테스트 | 소스 소유자 |
| `test/` (루트) | `setup.ts`, `msw/`, `fixtures/`, `render.tsx`, `constants.ts` | 데이터 담당 |
| `vitest.config.mts` | 환경, 가짜 env, 경로 alias | 데이터 담당 |

- `test/`는 FSD 레이어가 아니다. 테스트 파일만 `@/test/...`를 import한다. 앱 코드가 import하면 레이어 검사가 "테스트 누수"로 잡는다.
- 테스트 파일도 레이어 규칙을 지킨다. 다른 슬라이스는 공개 API(`index.ts`)로만 가져온다. 테스트 대상 슬라이스의 내부 파일은 상대 경로로 가져와도 된다.
- 슬라이스 내부 함수를 테스트하려면 `lib/`나 `model/`의 별도 파일로 뺀다. 테스트를 위해 공개 API를 넓히지 않는다.

## 단계별 기준

| 단계 | 대상 | 단언할 것 |
| --- | --- | --- |
| 순수 함수 | `model/`, `lib/`, `shared/api` 도우미 | 경계값: 빈 값, 공백, 특수 문자, 짝이 맞지 않는 입력 |
| 조회 훅 | `entities/*/api` | 요청 URL(`searchParams`의 디코딩 값), 반환 데이터 변환, 오류가 `Error` 인스턴스인지 |
| 위젯 | `widgets/*/ui` | 사용자에게 보이는 결과: 로딩, 데이터, 빈 상태, 오류와 재시도, 필터·검색 후 결과, 이전 결과 표시 |

- 위젯 테스트는 role, label, text로 요소를 찾는다. 테스트를 위해 `data-testid`를 붙이지 않는다. 접근성 이름이 없어 찾을 수 없다면 그 자체가 고쳐야 할 결함이다.
- 테스트 이름은 한국어로, 보장하는 동작을 쓴다. 예: "패스 탭을 누르면 패스 상품 9개만 보인다".

## 지켜야 할 설정

- **실제 원격 요청 금지.** `vitest.config.mts`의 `test.env`가 가짜 URL(`https://test.supabase.co`)과 키를 넣는다. MSW는 `onUnhandledRequest: 'error'`다. 처리하지 않은 요청이 나가면 테스트가 실패한다.
- **테스트마다 격리한다.** `renderWithQuery`와 `renderHookWithQuery`는 매번 새 QueryClient를 만들고 재시도를 끈다. MSW 덮어쓰기와 요청 기록은 테스트가 끝나면 자동으로 초기화된다.
- **globals를 쓰지 않는다.** `describe/it/expect/vi`는 `vitest`에서 import한다.
- **가짜 타이머는 원복한다.** 디바운스 테스트에서 `vi.useFakeTimers()`를 썼다면 `afterEach`에서 `vi.useRealTimers()`를 부른다.

## 공용 도구

- `renderWithQuery(ui)`는 `{ user, queryClient, ...RTL }`를 돌려준다. `renderHookWithQuery(hook)`도 있다.
- `server.use(...)`로 핸들러를 덮어쓴다(`@/test/msw/server`).
  - `productsErrorHandler(status?, body?)`: 오류 응답
  - `productsDelayHandler('infinite' | ms)`: 로딩 고정 또는 지연
  - `productsRowsHandler(rows)`: 원하는 행으로 응답. `[]`이면 빈 상태
  - `productsHeldHandler(rows?)`: `{ handler, release }`. `release()`를 부를 때까지 응답을 붙잡는다. 요청은 받는 즉시 기록된다. "응답 전" 상태 단언에는 `productsDelayHandler(ms)` 대신 이것을 쓴다
  - `productsNetworkErrorHandler()`: `fetch` 자체 실패. supabase-js 재시도를 껐으므로(`db: { retry: false }`) 요청은 1번이고 가짜 타이머가 필요 없다
- `getLastProductsRequest()`는 마지막 요청의 URL 객체를, `getProductsRequests()`는 이번 테스트의 요청 전부를 돌려준다.
- `productFixtures`는 `supabase/seed.sql`과 같은 12행이다. **seed를 바꾸면 fixtures도 같이 바꾼다.**
- 새 테이블을 추가하면 `test/msw/handlers.ts`에 같은 방식의 핸들러와 fixtures를 추가한다.

## 테스트가 제 역할을 하는지 확인

새 테스트를 쓰면 대상 코드를 일부러 한 번 틀리게 바꿔 실패하는지 본다. 예를 들어 이스케이프를 빼거나 디바운스를 0으로 바꾼다. 확인이 끝나면 반드시 원복한다. 한 번도 실패하지 않은 테스트는 아무것도 보장하지 않을 수 있다.

## 서버 코드(BFF) 테스트

Route Handler와 `*.server.ts` 모듈을 둔 뒤의 규칙이다. 이 프로젝트의 적용 계획은 `_workspace/06_architect_bff-design.md` 4절에 있다.

- **두 층으로 가로챈다.** 브라우저 훅·위젯 테스트(jsdom)는 BFF 엔드포인트(`*/api/…`)를, 서버 조회 함수·라우트 테스트(node)는 외부 서비스(Supabase REST)를 MSW로 가로챈다. 한 테스트가 두 층을 모두 지나게 하지 않는다. 위젯 테스트가 외부 서비스 URL 형식에 다시 묶인다.
- **환경은 파일 이름으로 가른다.** 서버 모듈 테스트는 `*.server.test.ts`로 짓고 Vitest `projects`의 node 프로젝트가 맡는다. 나머지는 jsdom 프로젝트다.
- **`server-only`는 빈 모듈로 별칭한다.** Vitest는 `react-server` 조건으로 해석하지 않아 기본 `index.js`(바로 던짐)를 불러온다. `resolve.conditions`에 `react-server`를 넣으면 React까지 서버 빌드로 바뀌니 쓰지 않는다.
- **라우트 핸들러는 직접 호출한다.** `GET(new Request('http://localhost/api/…?…'))`의 `status`, 헤더, `await res.json()`을 단언한다. `route.ts`는 재수출뿐이라 테스트하지 않는다. 시간 초과처럼 실제 타이머가 필요한 분기는 값을 주입받는 팩토리(`createXHandler({ timeoutMs })`)로 만든다.
- **오류 본문에 외부 서비스 원문이 없는지** 단언한다(PostgREST code·message, SQL 오류). 보안 요구사항이 테스트로 남아야 한다.
