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
