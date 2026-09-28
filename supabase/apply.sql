-- 마이그레이션과 시드를 한 번에 적용하기 위해 합친 파일(SQL 편집기에 붙여 넣어 실행한다).
-- 순서: migrations/20260928000000_init_products.sql
--       → migrations/20260928010000_storage_images.sql
--       → seed.sql
-- 원본 파일을 바꾸면 이 파일도 같이 바꾼다. 모든 문장은 재실행해도 결과가 같다.
--
-- 주의: 이미지 파일(객체) 자체는 SQL 로 만들 수 없다. 원본은 저장소에 두지 않는다(2026-09-28 사용자 결정).
--       새 프로젝트에서는 실행 후 대시보드 Storage 의 `images` 버킷에 다음 경로로 직접 올린다.
--         products/hidden-kice-pass.png
--         products/hidden-kice-single.png
--         banners/promo-banner-1.png

-- ═══ migrations/20260928000000_init_products.sql ═══════════════════════════
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
  image_url     text        not null,                             -- Storage `images` 버킷 안의 객체 경로(전체 URL 아님)
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

-- ═══ migrations/20260928010000_storage_images.sql ══════════════════════════
-- 콘텐츠 이미지(상품, 배너) 저장소
-- 이미지를 public/ 에 두면 상품을 추가할 때마다 재배포해야 한다.
-- 데이터(products.image_url)와 이미지를 같은 곳(Supabase)에서 관리한다.
--
-- public 버킷: 공개 URL(/storage/v1/object/public/images/...)로 누구나 읽는다.
-- storage.objects 에 anon 정책을 두지 않으므로 목록 조회와 업로드·삭제는 막힌다.
-- 업로드는 대시보드 Storage 에서 직접 한다(파일 머리말의 세 경로).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ═══ seed.sql ══════════════════════════════════════════════════════════════
-- 시안 홈 그리드의 카드 12개를 그대로 옮긴 더미 데이터.
-- 재실행해도 결과가 같도록 id 를 고정하고 on conflict 로 갱신한다.
--
-- 상품명: 시안은 12개 모두 "2026 Hidden Kice 시즌7" 이지만,
--         검색 기능(시안 주석: "검색 기능 및 필터기능 구현 요망")을 확인할 수 없으므로
--         과목/시즌만 다르게 뒀다. 시안 문자열 그대로가 필요하면 title 값만 바꾸면 된다.
-- 가격:   시안의 76,000 → 5% → 64,800 을 그대로 사용한다(계산값이 아니라 시안 표기값이다).
-- 이미지: Storage `images` 버킷 안의 객체 경로만 저장한다(예: products/hidden-kice-pass.png).
--         전체 URL 을 넣지 않는다. 프로젝트가 바뀌어도 데이터를 그대로 쓰기 위해서다.
--         공개 URL 은 useProducts 가 getStorageImageUrl 로 만든다.

insert into public.products (id, product_type, title, price, sale_price, discount_rate, image_url, sort_order)
values
  ('11111111-1111-4111-8111-000000000001', '단품', '2026 Hidden Kice 시즌7',        40000, null,  null, 'products/hidden-kice-single.png', 1),
  ('11111111-1111-4111-8111-000000000002', '패스', '2026 Hidden Kice 시즌7 올패스', 76000, 64800, 5,    'products/hidden-kice-pass.png',   2),
  ('11111111-1111-4111-8111-000000000003', '패스', '2026 Hidden Kice 국어 패스',    76000, 64800, 5,    'products/hidden-kice-pass.png',   3),
  ('11111111-1111-4111-8111-000000000004', '패스', '2026 Hidden Kice 수학 패스',    76000, 64800, 5,    'products/hidden-kice-single.png', 4),
  ('11111111-1111-4111-8111-000000000005', '패스', '2026 Hidden Kice 영어 패스',    76000, 64800, 5,    'products/hidden-kice-single.png', 5),
  ('11111111-1111-4111-8111-000000000006', '패스', '2026 Hidden Kice 탐구 패스',    76000, 64800, 5,    'products/hidden-kice-pass.png',   6),
  ('11111111-1111-4111-8111-000000000007', '단품', '2026 Hidden Kice 시즌6',        40000, null,  null, 'products/hidden-kice-single.png', 7),
  ('11111111-1111-4111-8111-000000000008', '패스', '2026 Hidden Kice 시즌6 올패스', 76000, 64800, 5,    'products/hidden-kice-pass.png',   8),
  ('11111111-1111-4111-8111-000000000009', '단품', '2026 Hidden Kice 시즌5',        40000, null,  null, 'products/hidden-kice-single.png', 9),
  ('11111111-1111-4111-8111-000000000010', '패스', '2026 Hidden Kice 시즌5 올패스', 76000, 64800, 5,    'products/hidden-kice-pass.png',   10),
  ('11111111-1111-4111-8111-000000000011', '패스', '2025 Hidden Kice 파이널 패스',  76000, 64800, 5,    'products/hidden-kice-pass.png',   11),
  ('11111111-1111-4111-8111-000000000012', '패스', '2025 Hidden Kice 기출 패스',    76000, 64800, 5,    'products/hidden-kice-single.png', 12)
on conflict (id) do update set
  product_type  = excluded.product_type,
  title         = excluded.title,
  price         = excluded.price,
  sale_price    = excluded.sale_price,
  discount_rate = excluded.discount_rate,
  image_url     = excluded.image_url,
  sort_order    = excluded.sort_order;
