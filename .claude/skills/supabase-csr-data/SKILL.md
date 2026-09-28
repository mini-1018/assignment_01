---
name: supabase-csr-data
description: "Supabase 테이블·더미 데이터·RLS를 만들고 브라우저(CSR)에서 조회하는 데이터 레이어를 FSD 구조로 구현하는 규칙을 제공한다. 스키마 설계, 시드 데이터 삽입, 클라이언트 조회 훅 작성, 타입 생성, 데이터가 화면에 안 나오는 문제 해결을 요청받으면 사용한다. 서버 전용 데이터 처리나 다른 백엔드를 쓰는 경우에는 사용하지 않는다."
---

# Supabase + CSR 데이터 레이어

## 이 구성의 전제

데이터는 **브라우저에서** 가져온다. 서버 컴포넌트에서 미리 가져오면 CSR이 아니다. 그래서 다음 세 가지가 동시에 성립해야 한다.

1. 조회 코드가 `'use client'` 파일 안에 있다.
2. 브라우저에 노출되는 키는 anon 키뿐이다.
3. anon 역할로 읽을 수 있도록 RLS 정책이 열려 있다.

셋 중 하나만 어긋나도 화면은 오류 없이 빈 배열을 렌더링한다. 이 조합이 이 구성에서 가장 많은 시간을 잡아먹는 지점이다.

## 1. 환경 변수

`.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://{project}.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY={anon key}
```

- `NEXT_PUBLIC_` 접두사가 붙은 값은 번들에 그대로 들어간다. service_role 키를 여기에 넣으면 데이터베이스 전체 권한이 공개된다. 절대 넣지 않는다.
- `.env.local`은 `.gitignore`에 있어야 한다. `.env.example`에는 키 이름만 남긴다.
- Vercel에도 같은 두 변수를 등록한다. 등록하지 않으면 로컬은 되고 배포본만 빈 화면이 된다.

## 2. 클라이언트 — `src/shared/api/supabase/client.ts`

```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
```

클라이언트는 한 번만 만들어 재사용한다. 컴포넌트 안에서 `createClient`를 호출하면 렌더링마다 새 연결 설정이 생긴다.

## 3. 스키마와 시드

```
supabase/
  migrations/20260101000000_init.sql   # 테이블, 인덱스, RLS 정책
  seed.sql                             # 더미 데이터
```

테이블 정의 규칙:

- 기본 키는 `id uuid primary key default gen_random_uuid()`.
- 생성 시각 `created_at timestamptz not null default now()`.
- 컬럼 이름은 스네이크 케이스. 화면에서는 생성된 타입을 그대로 쓰고 카멜 케이스로 바꾸지 않는다. 변환 계층을 두면 이름이 두 벌이 되어 불일치가 생긴다.
- 목록 정렬 기준 컬럼에는 인덱스를 만든다.

RLS 정책(더미 데이터라도 끄지 않는다):

```sql
alter table public.products enable row level security;

create policy "anon can read products"
  on public.products for select
  to anon
  using (true);
```

RLS를 끄면 당장은 편하지만, 나중에 인증을 붙일 때 어떤 테이블이 의도적으로 공개였는지 알 수 없다. 읽기만 여는 정책을 처음부터 명시한다.

시드는 재실행해도 같은 결과가 되게 쓴다.

```sql
insert into public.products (id, title, price)
values ('...uuid...', '상품 A', 12000)
on conflict (id) do nothing;
```

## 4. 타입 생성

```bash
npx supabase gen types typescript --project-id {ref} > src/shared/api/supabase/types.ts
```

손으로 쓴 타입과 실제 컬럼이 어긋나는 것이 이 구성의 대표적 결함이다. 스키마를 바꿀 때마다 타입을 다시 생성한다. CLI를 쓸 수 없는 상황이면 타입 파일 맨 위에 "수동 작성, 스키마와 대조 필요"라고 적는다.

## 5. 조회 훅 — `src/entities/{도메인}/api/`

```ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/api/supabase/client';
import type { Product } from '../model/types';

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('id, title, price, image_url')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
```

규칙:

- `error`를 반드시 검사해 throw한다. Supabase 클라이언트는 실패해도 예외를 던지지 않고 `{ data: null, error }`를 반환한다. 검사를 빠뜨리면 화면은 "데이터 없음"으로 보이고 원인은 남지 않는다.
- `select('*')` 대신 필요한 컬럼을 나열한다. 화면이 쓰는 필드가 코드에 드러나야 스키마 변경의 영향 범위를 알 수 있다.
- 훅은 도메인 타입을 반환한다. Supabase 응답 구조를 그대로 밖으로 흘리지 않는다.
- `queryKey`는 조회 조건을 모두 포함한다. 조건이 바뀌어도 키가 같으면 이전 결과가 그대로 보인다.

프로바이더는 `src/app/providers/`에 두고 `app/layout.tsx`에서 감싼다. `QueryClient`는 `useState`로 한 번만 만든다. 모듈 최상위에서 만들면 사용자 간 캐시가 섞일 수 있다.

## 6. 화면 연결 계약

훅을 쓰는 컴포넌트는 세 상태를 모두 렌더링한다.

```tsx
const { data, isPending, error } = useProducts();
if (isPending) return <ListSkeleton />;
if (error) return <ErrorState onRetry={refetch} />;
if (!data.length) return <EmptyState />;
```

CSR에서는 첫 렌더에 데이터가 없는 것이 정상 경로다. 로딩 처리를 나중으로 미루면 빈 화면이 잠깐 지나가는 것이 아니라 레이아웃이 튄다.

훅 계약이 바뀌면 `_workspace/03_data_contract.md`의 표를 먼저 고치고 사용처를 갱신한다.

| 훅 | 인자 | 반환 필드 | 사용 화면 |
| --- | --- | --- | --- |

## 7. 데이터가 안 보일 때 점검 순서

순서대로 확인한다. 위쪽이 훨씬 자주 원인이다.

1. 브라우저 네트워크 탭에 `/rest/v1/` 요청이 있는가 — 없으면 조회 코드가 클라이언트에서 실행되지 않은 것이다.
2. 응답이 200에 빈 배열인가 — RLS 정책이 없거나 anon에 열려 있지 않다.
3. 401/403인가 — anon 키가 비었거나 잘못됐다. 환경 변수 이름의 오타를 확인한다.
4. 요청 자체가 없고 콘솔에 `supabaseUrl is required`가 있는가 — `.env.local`이 없거나 개발 서버를 재시작하지 않았다.
5. 데이터는 왔는데 화면이 비었는가 — 훅 반환 필드명과 컴포넌트가 읽는 필드명을 대조한다.
6. 시드가 실제로 들어갔는가 — 대시보드 테이블 편집기에서 행 수를 직접 확인한다.
