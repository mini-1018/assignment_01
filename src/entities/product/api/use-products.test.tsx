import { describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { BFF_PRODUCTS_URL } from '@/test/constants';
import { productFixtures, productItemFixtures } from '@/test/fixtures/products';
import {
  getLastProductsRequest,
  getProductsRequests,
  productsErrorHandler,
  productsHeldHandler,
  productsNetworkErrorHandler,
} from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderHookWithQuery } from '@/test/render';
import { ApiError, isNetworkError, NetworkError } from '@/shared/api/http';
import type { ProductQuery } from '../model/types';
import { useProducts } from './use-products';

/**
 * 브라우저 층: 훅은 BFF `GET /api/products` 만 부른다. Supabase URL 형식은 여기서 단언하지 않는다
 * (서버 층 src/app/api-routes/products.server.test.ts 와 get-products.server.test.ts 가 맡는다).
 */

async function renderProducts(query: ProductQuery) {
  const utils = renderHookWithQuery(() => useProducts(query));
  await waitFor(() => expect(utils.result.current.isPending).toBe(false));
  return utils;
}

describe('useProducts', () => {
  it('조건이 없으면 쿼리 문자열 없이 /api/products 를 부르고 { items } 를 Product[] 로 돌려준다', async () => {
    const { result } = await renderProducts({ keyword: '', type: null });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(productItemFixtures);

    const url = getLastProductsRequest();
    expect(url.pathname).toBe('/api/products');
    expect(url.search).toBe('');
  });

  it("유형 '패스'면 type=패스 만 보낸다(빈 keyword 는 보내지 않는다)", async () => {
    const { result } = await renderProducts({ keyword: '', type: '패스' });

    const url = getLastProductsRequest();
    expect(url.searchParams.get('type')).toBe('패스');
    expect(url.searchParams.has('keyword')).toBe(false);
    expect(result.current.data).toHaveLength(9);
    expect(result.current.data?.every((p) => p.product_type === '패스')).toBe(true);
  });

  it('검색어는 trim 해 keyword 로 보낸다(null type 은 보내지 않는다)', async () => {
    const { result } = await renderProducts({ keyword: '  국어  ', type: null });

    const url = getLastProductsRequest();
    expect(url.searchParams.get('keyword')).toBe('국어');
    expect(url.searchParams.has('type')).toBe(false);
    expect(result.current.data?.map((p) => p.title)).toEqual(['2026 Hidden Kice 국어 패스']);
  });

  it('공백만 있는 검색어는 keyword 를 보내지 않는다', async () => {
    const { result } = await renderProducts({ keyword: '   ', type: null });

    expect(getLastProductsRequest().search).toBe('');
    expect(result.current.data).toHaveLength(12);
  });

  it('유형과 검색어를 함께 보낸다', async () => {
    const { result } = await renderProducts({ keyword: '시즌7', type: '단품' });

    const url = getLastProductsRequest();
    expect(url.searchParams.get('type')).toBe('단품');
    expect(url.searchParams.get('keyword')).toBe('시즌7');
    expect(result.current.data?.map((p) => p.title)).toEqual(['2026 Hidden Kice 시즌7']);
  });

  it('특수 문자 검색어는 이스케이프하지 않고 그대로 보낸다(이스케이프는 서버 몫)', async () => {
    await renderProducts({ keyword: '50%_\\*', type: null });

    expect(getLastProductsRequest().searchParams.get('keyword')).toBe('50%_\\*');
  });

  it('BFF 가 준 image_url(공개 URL)을 그대로 돌려준다', async () => {
    const { result } = await renderProducts({ keyword: '', type: null });

    expect(result.current.data?.[0].image_url).toBe(productItemFixtures[0].image_url);
    expect(result.current.data?.[0].image_url).not.toBe(productFixtures[0].image_url);
  });

  it('오류 응답이면 status·code 를 가진 ApiError 이고 message 는 "문구 (code)" 다', async () => {
    server.use(productsErrorHandler(502));
    const { result } = await renderProducts({ keyword: '', type: null });

    expect(result.current.data).toBeUndefined();
    const error = result.current.error;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: 'UPSTREAM_ERROR' });
    expect(error?.message).toBe('상품 정보를 불러오지 못했습니다. (UPSTREAM_ERROR)');
    expect(isNetworkError(error)).toBe(false);
  });

  it('400 INVALID_QUERY 도 ApiError 로 받는다', async () => {
    server.use(
      productsErrorHandler(400, { error: { code: 'INVALID_QUERY', message: '검색어는 100자 이하로 입력해 주세요.' } }),
    );
    const { result } = await renderProducts({ keyword: '', type: null });

    expect(result.current.error).toMatchObject({ status: 400, code: 'INVALID_QUERY' });
    expect(result.current.error?.message).toBe('검색어는 100자 이하로 입력해 주세요. (INVALID_QUERY)');
  });

  it('503 UPSTREAM_UNAVAILABLE 은 ApiError 이며 연결 문제로 판별되지 않는다', async () => {
    server.use(
      productsErrorHandler(503, { error: { code: 'UPSTREAM_UNAVAILABLE', message: '상품 서버에 연결하지 못했습니다.' } }),
    );
    const { result } = await renderProducts({ keyword: '', type: null });

    expect(getProductsRequests()).toHaveLength(1);
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error).toMatchObject({ status: 503, code: 'UPSTREAM_UNAVAILABLE' });
    expect(isNetworkError(result.current.error)).toBe(false);
  });

  it('2xx 인데 items 가 배열이 아니면 INVALID_RESPONSE ApiError 다', async () => {
    server.use(http.get(BFF_PRODUCTS_URL, () => HttpResponse.json({ data: [] })));
    const { result } = await renderProducts({ keyword: '', type: null });

    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error).toMatchObject({ status: 200, code: 'INVALID_RESPONSE' });
  });

  it('BFF 에 닿지 못하면(fetch reject) 요청 1번 만에 NetworkError 가 되고 isNetworkError 가 true 다', async () => {
    server.use(productsNetworkErrorHandler());
    const { result } = await renderProducts({ keyword: '', type: null });

    expect(getProductsRequests()).toHaveLength(1);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeInstanceOf(NetworkError);
    expect(result.current.error?.message).toBe('서버에 연결하지 못했습니다.');
    expect(isNetworkError(result.current.error)).toBe(true);
  });

  it('응답이 오기 전에는 pending 이고, 요청은 이미 보내져 있다(productsHeldHandler)', async () => {
    const held = productsHeldHandler();
    server.use(held.handler);
    const { result } = renderHookWithQuery(() => useProducts({ keyword: '', type: '단품' }));

    await waitFor(() => expect(getProductsRequests()).toHaveLength(1));
    expect(getLastProductsRequest().searchParams.get('type')).toBe('단품');
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();

    held.release();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data).toHaveLength(3);
    expect(getProductsRequests()).toHaveLength(1);
  });
});
