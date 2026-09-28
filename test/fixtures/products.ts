import type { Product } from '@/entities/product';
import type { ProductRow } from '@/shared/api/supabase';
import { TEST_PUBLIC_IMAGE_BASE } from '../constants';

/**
 * supabase/seed.sql 과 같은 12행(단품 3, 패스 9). image_url 은 Storage 객체 경로다.
 * seed.sql 을 바꾸면 이 파일도 함께 바꾼다.
 */
const CREATED_AT = '2026-09-28T00:00:00+00:00';

type SeedRow = Omit<ProductRow, 'created_at'>;

const SINGLE_IMAGE = 'products/hidden-kice-single.png';
const PASS_IMAGE = 'products/hidden-kice-pass.png';

const single = (n: number, title: string, image_url: string): SeedRow => ({
  id: `11111111-1111-4111-8111-0000000000${String(n).padStart(2, '0')}`,
  product_type: '단품',
  title,
  price: 40000,
  sale_price: null,
  discount_rate: null,
  image_url,
  sort_order: n,
});

const pass = (n: number, title: string, image_url: string): SeedRow => ({
  id: `11111111-1111-4111-8111-0000000000${String(n).padStart(2, '0')}`,
  product_type: '패스',
  title,
  price: 76000,
  sale_price: 64800,
  discount_rate: 5,
  image_url,
  sort_order: n,
});

export const productFixtures: readonly ProductRow[] = [
  single(1, '2026 Hidden Kice 시즌7', SINGLE_IMAGE),
  pass(2, '2026 Hidden Kice 시즌7 올패스', PASS_IMAGE),
  pass(3, '2026 Hidden Kice 국어 패스', PASS_IMAGE),
  pass(4, '2026 Hidden Kice 수학 패스', SINGLE_IMAGE),
  pass(5, '2026 Hidden Kice 영어 패스', SINGLE_IMAGE),
  pass(6, '2026 Hidden Kice 탐구 패스', PASS_IMAGE),
  single(7, '2026 Hidden Kice 시즌6', SINGLE_IMAGE),
  pass(8, '2026 Hidden Kice 시즌6 올패스', PASS_IMAGE),
  single(9, '2026 Hidden Kice 시즌5', SINGLE_IMAGE),
  pass(10, '2026 Hidden Kice 시즌5 올패스', PASS_IMAGE),
  pass(11, '2025 Hidden Kice 파이널 패스', PASS_IMAGE),
  pass(12, '2025 Hidden Kice 기출 패스', SINGLE_IMAGE),
].map((row) => ({ ...row, created_at: CREATED_AT }));

/**
 * DB 행을 BFF 가 내보내는 모양(`Product`)으로 바꾼다. image_url 만 Storage 공개 URL 이 된다.
 * BFF 층 MSW 핸들러의 응답과, 서버 층 라우트 테스트의 기대값이 같은 함수를 쓴다.
 */
export function toProductItem(row: ProductRow): Product {
  return { ...row, image_url: `${TEST_PUBLIC_IMAGE_BASE}/${row.image_url}` };
}

/** `productFixtures` 를 BFF 응답 모양으로 바꾼 12개(sort_order 오름차순). */
export const productItemFixtures: readonly Product[] = productFixtures.map(toProductItem);
