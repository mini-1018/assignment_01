import { delay, http, HttpResponse } from 'msw';
import type { ApiErrorBody } from '@/shared/api/http';
import type { ProductRow } from '@/shared/api/supabase';
import { BFF_PRODUCTS_URL } from '../constants';
import { productFixtures, toProductItem } from '../fixtures/products';
import { clearSupabaseRequestLog, supabaseProductsHandler } from './supabase';

/**
 * 브라우저 층(jsdom) MSW 핸들러. 훅·위젯·뷰가 부르는 BFF `GET /api/products` 를 가로챈다.
 * BFF 계약(쿼리 `keyword`·`type`, 성공 `{ items }`, 오류 `{ error: { code, message } }`)만 안다.
 * Supabase URL 형식은 모른다. 그쪽은 test/msw/supabase.ts(서버 층)가 맡는다.
 *
 * 기본 응답은 실제 BFF 를 거치지 않고 fixtures 를 직접 거른다. 같은 입력에 대한 실제 BFF 결과가
 * 이 필터와 같은지는 서버 층 라우트 테스트(src/app/api-routes/products.server.test.ts)가 확인한다.
 */

// ─── 요청 기록 ────────────────────────────────────────────────────────────
const recorded: URL[] = [];

/** 이번 테스트에서 `/api/products` 로 보낸 요청 URL 전부(오래된 순). */
export function getProductsRequests(): readonly URL[] {
  return recorded;
}

/** 이번 테스트에서 `/api/products` 로 보낸 마지막 요청 URL. 요청이 없으면 예외를 던진다. */
export function getLastProductsRequest(): URL {
  const last = recorded.at(-1);
  if (!last) throw new Error('/api/products 요청이 한 번도 기록되지 않았다.');
  return last;
}

/** 두 층(BFF, Supabase)의 요청 기록을 모두 비운다. test/setup*.ts 가 테스트마다 부른다. */
export function clearRequestLog(): void {
  recorded.length = 0;
  clearSupabaseRequestLog();
}

function record(request: Request): URL {
  const url = new URL(request.url);
  recorded.push(url);
  return url;
}

// ─── BFF 동작 흉내 ────────────────────────────────────────────────────────
/** keyword(trim, 대소문자 무시 부분 일치, 글자 그대로)·type 을 적용하고 sort_order 로 정렬한 `{ items }`. */
function productsBody(url: URL, rows: readonly ProductRow[]) {
  const keyword = (url.searchParams.get('keyword') ?? '').trim().toLowerCase();
  const type = url.searchParams.get('type');
  const items = rows
    .filter((row) => !type || row.product_type === type)
    .filter((row) => !keyword || row.title.toLowerCase().includes(keyword))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(toProductItem);
  return { items };
}

// ─── 기본 핸들러 ──────────────────────────────────────────────────────────
// 두 층을 모두 등록한다. 브라우저 층은 BFF 만, 서버 층은 Supabase 만 부르므로 서로 겹치지 않는다.
export const handlers = [
  http.get(BFF_PRODUCTS_URL, ({ request }) => {
    const url = record(request);
    return HttpResponse.json(productsBody(url, productFixtures));
  }),
  supabaseProductsHandler(),
];

// ─── 테스트별 덮어쓰기 ────────────────────────────────────────────────────
// `server.use(...)` 에 넘길 핸들러를 만든다. 모두 요청을 기록한다.
// 덮어쓰기는 test/setup.ts 의 resetHandlers 로 테스트마다 풀린다.

/** BFF 오류 응답. 기본값은 502 UPSTREAM_ERROR(Supabase 가 오류로 응답한 경우)다. */
export function productsErrorHandler(
  status = 502,
  body: ApiErrorBody = { error: { code: 'UPSTREAM_ERROR', message: '상품 정보를 불러오지 못했습니다.' } },
) {
  return http.get(BFF_PRODUCTS_URL, ({ request }) => {
    record(request);
    return HttpResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  });
}

/** 지연 응답. `'infinite'` 면 응답하지 않는다(로딩 상태 고정). 지연 뒤에는 기본과 같이 거른 결과를 준다. */
export function productsDelayHandler(
  ms: number | 'infinite',
  rows: readonly ProductRow[] = productFixtures,
) {
  return http.get(BFF_PRODUCTS_URL, async ({ request }) => {
    const url = record(request);
    await delay(ms);
    return HttpResponse.json(productsBody(url, rows));
  });
}

/** 다른 데이터(빈 배열 등)에 같은 필터를 적용해 돌려준다. `[]` 이면 빈 상태다. */
export function productsRowsHandler(rows: readonly ProductRow[]) {
  return http.get(BFF_PRODUCTS_URL, ({ request }) => {
    const url = record(request);
    return HttpResponse.json(productsBody(url, rows));
  });
}

/**
 * 브라우저가 BFF 에 닿지 못한다(`fetch` 가 TypeError 로 reject). 훅은 `NetworkError` 를 던지고
 * `isNetworkError` 가 true 다. 요청은 매번 기록되므로 `getProductsRequests()` 길이로 재시도 횟수를 단언할 수 있다.
 */
export function productsNetworkErrorHandler() {
  return http.get(BFF_PRODUCTS_URL, ({ request }) => {
    record(request);
    return HttpResponse.error();
  });
}

/**
 * 테스트가 응답 시점을 정하는 핸들러. `release()` 를 부를 때까지 응답을 붙잡는다.
 * 실제 시간에 기대는 `productsDelayHandler(ms)` 와 달리 느린 환경에서도 "응답 전" 단언이 흔들리지 않는다.
 *
 * - 붙잡힌 요청도 즉시 공용 요청 기록(`getProductsRequests`, `getLastProductsRequest`)에 남는다.
 * - `release()` 는 그때까지 붙잡힌 요청을 모두 풀고, 이후 요청은 붙잡지 않고 바로 응답한다.
 * - 응답은 기본 핸들러와 같이 `rows`(기본 fixtures)를 거른 결과다.
 *
 * ```ts
 * const held = productsHeldHandler();
 * server.use(held.handler);
 * await user.click(passTab);
 * await waitFor(() => expect(listRegion()).toHaveAttribute('aria-busy', 'true'));
 * expect(getLastProductsRequest().searchParams.get('type')).toBe('패스');
 * held.release();
 * ```
 */
export function productsHeldHandler(rows: readonly ProductRow[] = productFixtures) {
  let open: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  const handler = http.get(BFF_PRODUCTS_URL, async ({ request }) => {
    const url = record(request);
    await gate;
    return HttpResponse.json(productsBody(url, rows));
  });
  return { handler, release: () => open() };
}
