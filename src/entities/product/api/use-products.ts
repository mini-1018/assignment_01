'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ApiError, requestJson } from '@/shared/api/http';
import { toProductsSearchParams, type ProductsResponse } from '../model/products-api';
import type { Product, ProductQuery } from '../model/types';

const PRODUCTS_URL = '/api/products';

/**
 * 상품 목록을 브라우저에서 BFF(`GET /api/products`)로 조회한다(CSR).
 * Supabase 조회는 서버(src/app/api-routes → getProducts)가 한다. 브라우저는 Supabase 를 직접 부르지 않는다.
 *
 * 검색어와 유형 필터는 queryKey 에 포함된다. 키가 같으면 이전 결과가 그대로 보이므로
 * 조건이 바뀌면 반드시 키도 바뀌어야 한다.
 *
 * 오류: BFF 가 오류로 응답하면 `ApiError`(status·code), BFF 에 닿지 못하면 `NetworkError` 를 던진다.
 */
export function useProducts({ keyword, type }: ProductQuery) {
  return useQuery({
    queryKey: ['products', { keyword, type }],
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<Product[]> => {
      const search = toProductsSearchParams({ keyword, type }).toString();
      const url = search ? `${PRODUCTS_URL}?${search}` : PRODUCTS_URL;
      const response = await requestJson<ProductsResponse>(url, { signal });

      if (!Array.isArray(response?.items)) {
        throw new ApiError({ status: 200, code: 'INVALID_RESPONSE', message: '응답을 해석하지 못했습니다.' });
      }
      return response.items;
    },
  });
}
