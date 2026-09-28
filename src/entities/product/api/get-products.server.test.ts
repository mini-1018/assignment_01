import { describe, expect, it } from 'vitest';
import { TEST_PUBLIC_IMAGE_BASE } from '@/test/constants';
import { productFixtures } from '@/test/fixtures/products';
import { server } from '@/test/msw/server';
import {
  getLastSupabaseProductsRequest,
  getSupabaseProductsRequests,
  supabaseProductsErrorHandler,
  supabaseProductsHeldHandler,
  supabaseProductsNetworkErrorHandler,
} from '@/test/msw/supabase';
import { SupabaseQueryError } from '@/shared/api/supabase/index.server';
import type { ProductQuery } from '../model/types';
import { getProducts } from './get-products.server';

const all: ProductQuery = { keyword: '', type: null };

async function catchError(promise: Promise<unknown>): Promise<SupabaseQueryError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof SupabaseQueryError) return error;
    throw error;
  }
  throw new Error('예외가 발생하지 않았다.');
}

describe('getProducts', () => {
  it('조건이 없으면 12개 전부를 sort_order 오름차순으로 돌려주고 필터를 보내지 않는다', async () => {
    const products = await getProducts(all);

    expect(products.map((p) => p.sort_order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const url = getLastSupabaseProductsRequest();
    expect(url.searchParams.get('order')).toBe('sort_order.asc');
    expect(url.searchParams.has('product_type')).toBe(false);
    expect(url.searchParams.has('title')).toBe(false);
  });

  it('화면이 쓰는 컬럼만 명시해 select 한다(* 를 쓰지 않는다)', async () => {
    await getProducts(all);

    expect(getLastSupabaseProductsRequest().searchParams.get('select')?.split(',')).toEqual([
      'id',
      'product_type',
      'title',
      'price',
      'sale_price',
      'discount_rate',
      'image_url',
      'sort_order',
      'created_at',
    ]);
  });

  it("유형 '패스'면 product_type=eq.패스 로 요청하고 패스 9개만 돌려준다", async () => {
    const products = await getProducts({ keyword: '', type: '패스' });

    expect(getLastSupabaseProductsRequest().searchParams.get('product_type')).toBe('eq.패스');
    expect(products).toHaveLength(9);
    expect(products.every((p) => p.product_type === '패스')).toBe(true);
  });

  it("검색어 '국어'는 %로 감싼 ilike 로 요청하고(원문 URL 에서는 %25) 1개를 돌려준다", async () => {
    const products = await getProducts({ keyword: '국어', type: null });

    const url = getLastSupabaseProductsRequest();
    expect(url.searchParams.get('title')).toBe('ilike.%국어%');
    expect(url.search).toContain(`title=ilike.%25${encodeURIComponent('국어')}%25`);
    expect(products.map((p) => p.title)).toEqual(['2026 Hidden Kice 국어 패스']);
  });

  it('검색어 앞뒤 공백은 잘라서 요청한다', async () => {
    const products = await getProducts({ keyword: '  국어  ', type: null });

    expect(getLastSupabaseProductsRequest().searchParams.get('title')).toBe('ilike.%국어%');
    expect(products).toHaveLength(1);
  });

  it('공백만 있는 검색어는 title 필터 없이 전체를 요청한다', async () => {
    const products = await getProducts({ keyword: '   ', type: null });

    expect(getLastSupabaseProductsRequest().searchParams.has('title')).toBe(false);
    expect(products).toHaveLength(12);
  });

  it.each([
    // 디코딩된 값 기준. 각 특수 문자 앞에 백슬래시 하나가 붙는다(JS 문자열이라 '\\' 가 백슬래시 한 글자).
    ['%', 'ilike.%\\%%'],
    ['_', 'ilike.%\\_%'],
    ['\\', 'ilike.%\\\\%'],
    ['*', 'ilike.%\\*%'],
  ])("검색어 '%s'는 이스케이프해 title=%s 로 요청하고 0개가 된다", async (keyword, expected) => {
    const products = await getProducts({ keyword, type: null });

    expect(getLastSupabaseProductsRequest().searchParams.get('title')).toBe(expected);
    expect(products).toEqual([]);
  });

  it('유형과 검색어를 함께 주면 두 조건을 모두 요청한다', async () => {
    const products = await getProducts({ keyword: '시즌7', type: '단품' });

    const url = getLastSupabaseProductsRequest();
    expect(url.searchParams.get('product_type')).toBe('eq.단품');
    expect(url.searchParams.get('title')).toBe('ilike.%시즌7%');
    expect(products.map((p) => p.title)).toEqual(['2026 Hidden Kice 시즌7']);
  });

  it('image_url 은 객체 경로가 아니라 Storage 공개 URL 로 바뀌어 나온다', async () => {
    const products = await getProducts(all);

    expect(productFixtures[0].image_url).toBe('products/hidden-kice-single.png');
    expect(products[0].image_url).toBe(`${TEST_PUBLIC_IMAGE_BASE}/products/hidden-kice-single.png`);
    expect(products.every((p) => p.image_url.startsWith(`${TEST_PUBLIC_IMAGE_BASE}/products/`))).toBe(true);
  });

  it('PostgREST 오류 응답이면 kind=rejected 인 SupabaseQueryError 를 던지고 원본은 cause 에 둔다', async () => {
    server.use(supabaseProductsErrorHandler(500));

    const error = await catchError(getProducts(all));
    expect(error).toMatchObject({ kind: 'rejected', code: 'PGRST000', status: 500 });
    expect(error.cause).toMatchObject({ code: 'PGRST000', message: 'Could not connect to database' });
  });

  it('503 응답도 supabase-js 가 다시 시도하지 않고 요청 1번 만에 rejected 가 된다', async () => {
    server.use(supabaseProductsErrorHandler(503));

    const error = await catchError(getProducts(all));
    // 서버 클라이언트의 db.retry: false 로 postgrest-js 자체 재시도(1s·2s·4s)를 껐다.
    expect(getSupabaseProductsRequests()).toHaveLength(1);
    expect(error).toMatchObject({ kind: 'rejected', status: 503 });
  });

  it('Supabase 에 닿지 못하면(fetch reject) 요청 1번 만에 kind=unavailable 이 된다', async () => {
    server.use(supabaseProductsNetworkErrorHandler());

    const error = await catchError(getProducts(all));
    expect(getSupabaseProductsRequests()).toHaveLength(1);
    expect(error).toMatchObject({ kind: 'unavailable', code: '', status: 0 });
  });

  it('signal 이 시간 초과되면 요청을 끊고 kind=timeout 이 된다', async () => {
    server.use(supabaseProductsHeldHandler().handler);

    const error = await catchError(getProducts(all, { signal: AbortSignal.timeout(20) }));
    expect(getSupabaseProductsRequests()).toHaveLength(1);
    expect(error.kind).toBe('timeout');
    expect(error.message).toMatch(/^TimeoutError: /);
  });

  it('signal 이 취소되면 kind=timeout 이 된다(AbortError)', async () => {
    server.use(supabaseProductsHeldHandler().handler);
    const controller = new AbortController();
    const pending = catchError(getProducts(all, { signal: controller.signal }));
    controller.abort();

    const error = await pending;
    expect(error.kind).toBe('timeout');
    expect(error.message).toMatch(/^AbortError: /);
  });
});
