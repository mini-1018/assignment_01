# FSD 세부 규약 — 별칭, 설정, 네이밍

`SKILL.md`에서 구조 규칙을 확인한 뒤, 실제 설정 값이 필요할 때 읽는다.

## 1. 경로 별칭

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

별칭을 하나(`@/`)만 둔다. 레이어마다 별칭을 따로 만들면(`@entities/`, `@features/`) 레이어 이름이 경로에서 사라져 import 한 줄만 보고는 의존 방향을 알 수 없다. 검사 스크립트도 `@/`와 상대 경로만 해석한다.

상대 경로는 **같은 슬라이스 안에서만** 쓴다. 슬라이스를 넘어가면 `@/`를 쓴다. `../../entities/...` 형태가 보이면 규칙 위반의 신호다.

## 2. 슬라이스 공개 API

```ts
// src/entities/product/index.ts
export { ProductCard } from './ui/ProductCard';
export { useProducts } from './api/useProducts';
export type { Product } from './model/types';
```

- `export *`를 쓰지 않는다. 내부 파일을 추가할 때마다 공개 범위가 저절로 늘어난다.
- 타입은 `export type`으로 내보낸다. 런타임 import가 생기지 않는다.

## 3. 네이밍

| 대상 | 규칙 | 예 |
| --- | --- | --- |
| 레이어 | 고정 이름 | `views`, `widgets`, `features`, `entities`, `shared` |
| 슬라이스 | 케밥 케이스 단수 | `product`, `auth-session` |
| 세그먼트 | 고정 이름 | `api`, `model`, `ui`, `lib`, `config` |
| 컴포넌트 파일 | 파스칼 케이스 | `ProductCard.tsx` |
| 훅 | `use` 접두사 | `useProducts.ts` |
| entity 슬라이스 | 명사 | `product` |
| feature 슬라이스 | 동사구 | `filter-products` |

## 4. ESLint 연동(선택)

스크립트 검사로 충분하지만, 편집기에서 즉시 경고를 보려면 `eslint-plugin-boundaries`를 붙인다.

```js
// eslint.config.mjs (요지)
settings: {
  'boundaries/elements': [
    { type: 'app',      pattern: 'src/app/*' },
    { type: 'views',    pattern: 'src/views/*' },
    { type: 'widgets',  pattern: 'src/widgets/*' },
    { type: 'features', pattern: 'src/features/*' },
    { type: 'entities', pattern: 'src/entities/*' },
    { type: 'shared',   pattern: 'src/shared/*' },
  ],
},
rules: {
  'boundaries/element-types': ['error', {
    default: 'disallow',
    rules: [
      { from: 'app',      allow: ['views', 'widgets', 'features', 'entities', 'shared'] },
      { from: 'views',    allow: ['widgets', 'features', 'entities', 'shared'] },
      { from: 'widgets',  allow: ['features', 'entities', 'shared'] },
      { from: 'features', allow: ['entities', 'shared'] },
      { from: 'entities', allow: ['shared'] },
      { from: 'shared',   allow: ['shared'] },
    ],
  }],
}
```

ESLint를 붙이더라도 CI와 QA 단계에서는 검사 스크립트를 실행한다. 편집기 설정에 의존하면 검사 여부가 사람마다 달라진다.

## 5. 'use client' 배치

- 데이터를 조회하거나 상태를 쓰는 컴포넌트 파일 맨 위에 붙인다.
- `app/**/page.tsx`에는 붙이지 않는다. 라우트는 서버 컴포넌트로 두고 `views`의 클라이언트 컴포넌트를 렌더링한다. 라우트를 통째로 클라이언트로 만들면 메타데이터 export 같은 서버 기능을 쓸 수 없다.
- `shared/ui`의 순수 표현 컴포넌트에는 붙이지 않는다. 이벤트 핸들러를 받는 컴포넌트만 클라이언트로 만든다.

## 6. 배럴 파일과 번들 크기

`index.ts` 재수출은 편리하지만, 한 슬라이스의 `index.ts`가 무거운 모듈을 함께 끌어오면 일부만 쓰는 화면도 전부 내려받는다. 슬라이스가 커지면 공개 API를 목적별로 나눈다(예: `entities/product`와 `entities/product/testing`).

## 7. 서버 전용 코드와 BFF(Route Handler)

브라우저가 외부 서비스(Supabase 등)를 직접 부르지 않고 Next Route Handler를 거치게 할 때의 배치 규칙이다. 이 프로젝트의 실제 설계는 `_workspace/06_architect_bff-design.md`에 있다.

### 7.1 공개 API를 환경별로 나눈다

| 파일 | 내보내는 것 | import 경로 |
| --- | --- | --- |
| `index.ts` | 클라이언트·서버 어디서 import해도 안전한 것(표현 컴포넌트, 브라우저 훅, 타입, 순수 함수) | `@/entities/product` |
| `index.server.ts` | 서버에서만 쓰는 것(`server-only` 조회 함수, 서버 컴포넌트 전용 도우미) | `@/entities/product/index.server` |

근거: FSD 공식 Next.js 가이드("Server and client public APIs")는 `index.ts`가 서버 전용 모듈을 내보내면 클라이언트 컴포넌트가 그 슬라이스를 import할 때 서버 전용 부수 효과가 클라이언트 모듈 그래프로 번진다고 보고, 서버 전용 모듈은 `index.server.ts`에 두라고 한다. FSD Public API 문서도 "같은 슬라이스 안 모듈도 실행 환경이 다를 수 있으니 실행 환경에 맞는 파일로 공개 API를 나눈다"고 적는다.

- `shared`의 세그먼트도 같은 이름을 쓴다(`@/shared/api/supabase` / `@/shared/api/supabase/index.server`).
- 경로 끝을 `index.server`로 적는다. `.../server` 같은 별도 폴더·별칭을 만들지 않는다. 이름 하나로 검사 스크립트와 사람이 같은 규칙을 본다.
- `index.server.ts`는 재수출만 한다. 그 자체에는 `import 'server-only'`가 없어도 된다(재수출 대상이 가진다).

### 7.2 서버 전용 파일

- 이름을 `*.server.ts(x)`로 짓고 파일 맨 위에 `import 'server-only'`를 둔다. 둘 중 하나라도 빠지면 검사 스크립트가 경고한다.
- `server-only`는 클라이언트 번들에 들어가는 순간 `next build`를 멈춘다(Next가 자체 처리). 검사 스크립트는 그보다 앞서 `'use client'` 파일과 `index.ts`의 직접 import를 잡는다. 서버 컴포넌트를 거친 간접 import는 빌드가 잡는다.
- 서버 환경 변수는 `NEXT_PUBLIC_` 없이 `src/shared/config/env.server.ts`에서만 읽는다.
- Vitest는 `react-server` 조건으로 해석하지 않으므로 `server-only`를 빈 모듈로 별칭한다(`references/testing.md`).

### 7.3 Route Handler 배치

```
app/api/products/route.ts           # export { GET } from '@/app/api-routes/index.server'  (재수출만)
src/app/api-routes/products.server.ts  # HTTP 어댑터: 쿼리 파싱·검증, 상태 코드·헤더, 오류 본문
src/app/api-routes/index.server.ts
src/entities/product/api/get-products.server.ts  # 도메인 조회: Supabase 호출, 이스케이프, URL 변환
```

- `src/app/api-routes`는 FSD 공식 Next.js 가이드가 Route Handler용으로 정한 app 레이어 세그먼트다. HTTP(요청·응답·상태 코드)는 여기서만 다루고, 도메인 조회는 entities가 `Request`/`Response`를 모른 채 한다.
- `route.ts`는 `export { GET } from ...` 재수출만 한다. `dynamic`·`runtime` 같은 라우트 세그먼트 설정이 필요하면 그 값만 `route.ts`에 리터럴로 적는다(Next가 정적으로 읽는다).
- API 라우트가 `@/…/index.server`를 직접 import하는 것은 허용되지만 기본은 `src/app/api-routes` 재수출이다.
