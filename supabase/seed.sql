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
