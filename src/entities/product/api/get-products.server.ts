import 'server-only';
import {
  getStorageImageUrl,
  getSupabaseServerClient,
  toSupabaseQueryError,
} from '@/shared/api/supabase/index.server';
import { escapeLikePattern } from '../lib/query';
import type { Product, ProductQuery } from '../model/types';

/** select 에 나열한 컬럼이 화면이 쓰는 필드의 전부다. '*' 를 쓰지 않는다. */
const PRODUCT_COLUMNS = 'id, product_type, title, price, sale_price, discount_rate, image_url, sort_order, created_at';

/**
 * 상품 목록을 서버에서 Supabase 로 조회한다(BFF `GET /api/products` 가 부른다).
 * `Request`/`Response` 를 모른다. HTTP 상태 코드는 호출한 라우트가 정한다.
 *
 * - `query.keyword` 는 trim 된 값을 받는다고 가정하지만, 한 번 더 trim 한다(서버 컴포넌트 등 다른 호출처 방어).
 * - 실패하면 `SupabaseQueryError`(kind: rejected | unavailable | timeout)를 던진다.
 *   supabase-js 는 실패해도 예외를 던지지 않고 `{ error, status }` 를 돌려주므로 여기서 반드시 검사한다.
 * - `signal` 은 `.abortSignal()` 로 붙인다. 라우트가 시간 초과(`AbortSignal.timeout`)를 넘긴다.
 */
export async function getProducts(
  { keyword, type }: ProductQuery,
  options: { signal?: AbortSignal } = {},
): Promise<Product[]> {
  let request = getSupabaseServerClient().from('products').select(PRODUCT_COLUMNS).order('sort_order');

  if (type) request = request.eq('product_type', type);
  const trimmed = keyword.trim();
  if (trimmed) request = request.ilike('title', `%${escapeLikePattern(trimmed)}%`);
  if (options.signal) request = request.abortSignal(options.signal);

  const { data, error, status } = await request;
  if (error) throw toSupabaseQueryError(error, status);

  // DB 는 Storage 객체 경로를 저장한다. 화면(product-card)은 image_url 을 그대로 src 로 쓰므로
  // 여기서 공개 URL 로 바꿔 돌려준다. 변환 위치는 이 한 곳뿐이다.
  return (data ?? []).map((row) => ({ ...row, image_url: getStorageImageUrl(row.image_url) }));
}
