import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { http, HttpResponse } from 'msw';
import { SUPABASE_PRODUCTS_ENDPOINT } from '@/test/constants';
import { productItemFixtures } from '@/test/fixtures/products';
import { server } from '@/test/msw/server';
import {
  getLastSupabaseProductsRequest,
  getSupabaseProductsRequests,
  supabaseProductsErrorHandler,
  supabaseProductsHeldHandler,
  supabaseProductsNetworkErrorHandler,
} from '@/test/msw/supabase';
import { createProductsHandler, GET } from './products.server';

/**
 * 서버 층: 라우트 핸들러를 직접 부르고, MSW 는 Supabase REST 만 가로챈다.
 * route.ts 는 재수출뿐이라 테스트하지 않는다.
 */

const CACHE_OK = 'public, max-age=0, s-maxage=60, stale-while-revalidate=60';

const call = (search = '') => GET(new Request(`http://localhost/api/products${search}`));

let consoleError: MockInstance;
beforeEach(() => {
  // 라우트는 실패를 console.error 로 남긴다. 출력만 막고 호출 여부는 필요한 곳에서 단언한다.
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => consoleError.mockRestore());

async function expectError(res: Response, status: number, code: string) {
  expect(res.status).toBe(status);
  expect(res.headers.get('Cache-Control')).toBe('no-store');
  const body = await res.json();
  expect(body).toEqual({ error: { code, message: expect.any(String) } });
  return { body, text: JSON.stringify(body) };
}

describe('GET /api/products', () => {
  it('200 { items } 를 돌려주고 CDN 캐시 헤더를 붙인다', async () => {
    const res = await call();

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(CACHE_OK);
    expect(await res.json()).toEqual({ items: productItemFixtures });
    expect(getSupabaseProductsRequests()).toHaveLength(1);
  });

  it('type·keyword 를 Supabase 필터로 넘긴다(keyword 는 trim)', async () => {
    const res = await call(`?type=${encodeURIComponent('패스')}&keyword=${encodeURIComponent('  국어 ')}`);

    const body = (await res.json()) as { items: { title: string }[] };
    expect(body.items.map((p) => p.title)).toEqual(['2026 Hidden Kice 국어 패스']);
    const url = getLastSupabaseProductsRequest();
    expect(url.searchParams.get('product_type')).toBe('eq.패스');
    expect(url.searchParams.get('title')).toBe('ilike.%국어%');
  });

  it.each([
    ['%', 'ilike.%\\%%'],
    ['_', 'ilike.%\\_%'],
    ['\\', 'ilike.%\\\\%'],
    ['*', 'ilike.%\\*%'],
  ])("검색어 '%s'는 이스케이프되어 Supabase 에 title=%s 로 실리고 0개가 된다", async (keyword, expected) => {
    const res = await call(`?keyword=${encodeURIComponent(keyword)}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [] });
    expect(getLastSupabaseProductsRequest().searchParams.get('title')).toBe(expected);
  });

  it.each([
    ['잘못된 type', `?type=${encodeURIComponent('묶음')}`],
    ['101자 keyword', `?keyword=${'가'.repeat(101)}`],
  ])('%s 는 Supabase 를 부르지 않고 400 INVALID_QUERY 다', async (_, search) => {
    const res = await call(search);

    await expectError(res, 400, 'INVALID_QUERY');
    expect(getSupabaseProductsRequests()).toHaveLength(0);
  });

  it('100자 keyword 는 허용한다(경계)', async () => {
    const res = await call(`?keyword=${'가'.repeat(100)}`);
    expect(res.status).toBe(200);
  });

  it('Supabase 가 오류로 응답하면 502 UPSTREAM_ERROR 이고 원문(PGRST code·message·details·hint)이 본문에 없다', async () => {
    server.use(
      supabaseProductsErrorHandler(400, {
        code: 'PGRST100',
        message: 'failed to parse filter (ilike)',
        details: 'unexpected "x" expecting "("',
        hint: 'check the column products.title',
      }),
    );
    const res = await call();

    const { text } = await expectError(res, 502, 'UPSTREAM_ERROR');
    for (const secret of ['PGRST', 'failed to parse filter', 'unexpected "x"', 'products.title', 'supabase']) {
      expect(text).not.toContain(secret);
    }
    expect(consoleError).toHaveBeenCalled();
  });

  it('Supabase 500(PGRST000) 도 502 이고 원문이 본문에 없다', async () => {
    server.use(supabaseProductsErrorHandler());
    const { text } = await expectError(await call(), 502, 'UPSTREAM_ERROR');
    expect(text).not.toContain('PGRST000');
    expect(text).not.toContain('Could not connect to database');
  });

  it('Supabase 에 닿지 못하면 503 UPSTREAM_UNAVAILABLE 이고 fetch 원문이 본문에 없다', async () => {
    server.use(supabaseProductsNetworkErrorHandler());
    const { text } = await expectError(await call(), 503, 'UPSTREAM_UNAVAILABLE');
    expect(getSupabaseProductsRequests()).toHaveLength(1);
    expect(text).not.toMatch(/TypeError|fetch failed|Failed to fetch/);
  });

  it('Supabase 가 timeoutMs 안에 응답하지 않으면 504 UPSTREAM_TIMEOUT 이다', async () => {
    const held = supabaseProductsHeldHandler();
    server.use(held.handler);
    const handler = createProductsHandler({ timeoutMs: 20 });

    const res = await handler(new Request('http://localhost/api/products'));
    held.release();

    const { text } = await expectError(res, 504, 'UPSTREAM_TIMEOUT');
    expect(text).not.toMatch(/TimeoutError|AbortError|aborted/);
  });

  it('처리 중 예외가 나면 500 INTERNAL_ERROR 이고 예외 문구가 본문에 없다', async () => {
    // 2xx 인데 배열이 아닌 본문 → getProducts 의 map 이 TypeError 를 던진다.
    server.use(http.get(SUPABASE_PRODUCTS_ENDPOINT, () => HttpResponse.json({ unexpected: true })));
    const { text } = await expectError(await call(), 500, 'INTERNAL_ERROR');
    expect(text).not.toMatch(/TypeError|map|is not a function/);
    expect(consoleError).toHaveBeenCalled();
  });
});
