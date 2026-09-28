import { describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/react';
import { productFixtures } from '@/test/fixtures/products';
import {
  getLastProductsRequest,
  getProductsRequests,
  productsErrorHandler,
  productsHeldHandler,
  productsNetworkErrorHandler,
} from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderHookWithQuery } from '@/test/render';
import { isNetworkError } from '../lib/query';
import type { ProductQuery } from '../model/types';
import { useProducts } from './use-products';

const PUBLIC_BASE = 'https://test.supabase.co/storage/v1/object/public/images';

async function renderProducts(query: ProductQuery) {
  const utils = renderHookWithQuery(() => useProducts(query));
  await waitFor(() => expect(utils.result.current.isPending).toBe(false));
  return utils;
}

describe('useProducts', () => {
  it('조건이 없으면 12개 전부를 sort_order 오름차순으로 돌려준다', async () => {
    const { result } = await renderProducts({ keyword: '', type: null });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toHaveLength(12);
    expect(result.current.data?.map((p) => p.sort_order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    const url = getLastProductsRequest();
    expect(url.searchParams.get('order')).toBe('sort_order.asc');
    expect(url.searchParams.has('product_type')).toBe(false);
    expect(url.searchParams.has('title')).toBe(false);
  });

  it('화면이 쓰는 컬럼만 명시해 select 한다(* 를 쓰지 않는다)', async () => {
    await renderProducts({ keyword: '', type: null });

    const columns = getLastProductsRequest().searchParams.get('select')?.split(',');
    expect(columns).toEqual([
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
    const { result } = await renderProducts({ keyword: '', type: '패스' });

    expect(getLastProductsRequest().searchParams.get('product_type')).toBe('eq.패스');
    expect(result.current.data).toHaveLength(9);
    expect(result.current.data?.every((p) => p.product_type === '패스')).toBe(true);
  });

  it("검색어 '국어'는 %로 감싼 ilike 로 요청하고(원문 URL 에서는 %25) 1개를 돌려준다", async () => {
    const { result } = await renderProducts({ keyword: '국어', type: null });

    const url = getLastProductsRequest();
    // supabase-js 는 like 와일드카드로 `*` 가 아니라 `%` 를 보내고, URLSearchParams 가 `%25` 로 인코딩한다.
    expect(url.searchParams.get('title')).toBe('ilike.%국어%');
    expect(url.search).toContain(`title=ilike.%25${encodeURIComponent('국어')}%25`);
    expect(result.current.data?.map((p) => p.title)).toEqual(['2026 Hidden Kice 국어 패스']);
  });

  it('검색어 앞뒤 공백은 잘라서 요청한다', async () => {
    const { result } = await renderProducts({ keyword: '  국어  ', type: null });

    expect(getLastProductsRequest().searchParams.get('title')).toBe('ilike.%국어%');
    expect(result.current.data).toHaveLength(1);
  });

  it('공백만 있는 검색어는 title 필터 없이 전체를 요청한다', async () => {
    const { result } = await renderProducts({ keyword: '   ', type: null });

    expect(getLastProductsRequest().searchParams.has('title')).toBe(false);
    expect(result.current.data).toHaveLength(12);
  });

  it("검색어 '%'는 이스케이프해 요청하므로 전체와 일치하지 않고 0개가 된다", async () => {
    const { result } = await renderProducts({ keyword: '%', type: null });

    expect(getLastProductsRequest().searchParams.get('title')).toBe('ilike.%\\%%');
    expect(result.current.data).toEqual([]);
  });

  it('유형과 검색어를 함께 주면 두 조건을 모두 요청한다', async () => {
    const { result } = await renderProducts({ keyword: '시즌7', type: '단품' });

    const url = getLastProductsRequest();
    expect(url.searchParams.get('product_type')).toBe('eq.단품');
    expect(url.searchParams.get('title')).toBe('ilike.%시즌7%');
    expect(result.current.data?.map((p) => p.title)).toEqual(['2026 Hidden Kice 시즌7']);
  });

  it('image_url 은 객체 경로가 아니라 Storage 공개 URL 로 바뀌어 나온다', async () => {
    const { result } = await renderProducts({ keyword: '', type: null });

    const first = result.current.data?.[0];
    expect(productFixtures[0].image_url).toBe('products/hidden-kice-single.png');
    expect(first?.image_url).toBe(`${PUBLIC_BASE}/products/hidden-kice-single.png`);
    expect(result.current.data?.every((p) => p.image_url.startsWith(`${PUBLIC_BASE}/products/`))).toBe(true);
  });

  it('500 오류 응답이면 error 가 Error 인스턴스이고 message 에 code 가 들어간다', async () => {
    server.use(productsErrorHandler(500));
    const { result } = await renderProducts({ keyword: '', type: null });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Could not connect to database (PGRST000)');
    expect(result.current.error?.cause).toMatchObject({ code: 'PGRST000' });
  });

  it('PGRST 오류(400) 응답도 Error 로 감싸고 code 를 message 에 남긴다', async () => {
    server.use(
      productsErrorHandler(400, {
        code: 'PGRST100',
        message: 'failed to parse filter',
        details: null,
        hint: null,
      }),
    );
    const { result } = await renderProducts({ keyword: '', type: null });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain('PGRST100');
  });

  it.each([
    // 디코딩된 값 기준. 각 특수 문자 앞에 백슬래시 하나가 붙는다(JS 문자열이라 '\\' 가 백슬래시 한 글자).
    ['_', 'ilike.%\\_%'],
    ['\\', 'ilike.%\\\\%'],
    ['*', 'ilike.%\\*%'],
  ])("검색어 '%s'는 이스케이프해 title=%s 로 요청하고 0개가 된다", async (keyword, expected) => {
    const { result } = await renderProducts({ keyword, type: null });

    expect(getLastProductsRequest().searchParams.get('title')).toBe(expected);
    expect(result.current.data).toEqual([]);
  });

  it('네트워크 자체가 실패하면(fetch reject) supabase-js 는 다시 시도하지 않고 요청 1번 만에 Error 가 된다', async () => {
    server.use(productsNetworkErrorHandler());
    const { result } = await renderProducts({ keyword: '', type: null });

    // client.ts 의 db.retry: false 로 postgrest-js 자체 재시도(1s·2s·4s)를 껐다. 재시도는 앱 QueryClient 몫이고
    // 테스트 QueryClient 는 retry 를 끄므로 요청은 정확히 1번이다. 가짜 타이머 없이 곧바로 끝난다.
    expect(getProductsRequests()).toHaveLength(1);
    expect(result.current.data).toBeUndefined();
    const error = result.current.error;
    expect(error).toBeInstanceOf(Error);
    // code 가 빈 문자열이라 message 뒤에 "()" 가 붙지 않는다.
    expect(error?.message).toBe('TypeError: Failed to fetch');
    expect(error?.cause).toMatchObject({ code: '', message: 'TypeError: Failed to fetch' });
    expect(isNetworkError(error)).toBe(true);
  });

  it('503 응답도 supabase-js 가 다시 시도하지 않고 요청 1번 만에 Error 가 되며, 연결 문제로 판별되지 않는다', async () => {
    server.use(productsErrorHandler(503));
    const { result } = await renderProducts({ keyword: '', type: null });

    expect(getProductsRequests()).toHaveLength(1);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Could not connect to database (PGRST000)');
    expect(isNetworkError(result.current.error)).toBe(false);
  });

  it('응답이 오기 전에는 pending 이고, 요청은 이미 보내져 있다(productsHeldHandler)', async () => {
    const held = productsHeldHandler();
    server.use(held.handler);
    const { result } = renderHookWithQuery(() => useProducts({ keyword: '', type: '단품' }));

    await waitFor(() => expect(getProductsRequests()).toHaveLength(1));
    expect(getLastProductsRequest().searchParams.get('product_type')).toBe('eq.단품');
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();

    held.release();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data).toHaveLength(3);
    expect(getProductsRequests()).toHaveLength(1);
  });
});
