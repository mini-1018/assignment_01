-- 상품(교재) 테이블
-- 시안: Vez3Pm043ITF7xkEPKeW9e / 홈 상품 그리드
-- 카드에 보이는 항목: 유형(단품|패스), 상품명, 정가, 할인율, 할인가, 이미지

create extension if not exists pgcrypto;

create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  product_type  text        not null check (product_type in ('단품', '패스')),
  title         text        not null,
  price         integer     not null check (price >= 0),          -- 정가(원)
  sale_price    integer     check (sale_price >= 0),              -- 할인가(원). 할인 없으면 null
  discount_rate integer     check (discount_rate between 0 and 100), -- 할인율(%). 할인 없으면 null
  image_url     text        not null,
  sort_order    integer     not null default 0,                   -- 시안의 노출 순서
  created_at    timestamptz not null default now(),

  -- 할인가와 할인율은 항상 함께 있거나 함께 없어야 한다.
  -- 한쪽만 있으면 카드가 '할인 중'과 '정가'의 중간 상태로 렌더링된다.
  constraint products_discount_pair check (
    (sale_price is null and discount_rate is null)
    or (sale_price is not null and discount_rate is not null)
  )
);

create index if not exists products_sort_order_idx   on public.products (sort_order);
create index if not exists products_product_type_idx on public.products (product_type);

-- RLS: 더미 데이터라도 끄지 않는다.
-- 지금 무엇이 의도적으로 공개인지 남겨 둬야 나중에 인증을 붙일 때 판단할 수 있다.
alter table public.products enable row level security;

drop policy if exists "anon can read products" on public.products;
create policy "anon can read products"
  on public.products
  for select
  to anon
  using (true);
