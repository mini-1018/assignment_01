import type { Product, ProductQuery, ProductType } from './types';

/**
 * `GET /api/products` 계약. 요청 쿼리 조립(브라우저 훅)과 파싱(BFF)은 같은 계약의 양면이라 한 파일에 둔다.
 * 순수 함수만 있으므로 클라이언트·서버가 모두 import 해도 된다.
 */

/** 검색어 최대 길이(trim 뒤, UTF-16 길이). 넘으면 BFF 가 400 으로 응답한다. */
export const PRODUCT_KEYWORD_MAX_LENGTH = 100;

/** 허용하는 상품 유형. DB check 제약과 같다. */
export const PRODUCT_TYPES = ['단품', '패스'] as const satisfies readonly ProductType[];

/** 200 응답 본문. 봉투를 두어 나중에 total·nextCursor 를 붙여도 형태가 깨지지 않게 한다. */
export type ProductsResponse = { items: Product[] };

/** 조회 조건을 쿼리 문자열로 바꾼다. trim 뒤 빈 keyword 와 null type 은 생략한다. */
export function toProductsSearchParams({ keyword, type }: ProductQuery): URLSearchParams {
  const params = new URLSearchParams();
  const trimmed = keyword.trim();
  if (trimmed) params.set('keyword', trimmed);
  if (type) params.set('type', type);
  return params;
}

export type ParsedProductsQuery =
  | { ok: true; query: ProductQuery }
  | { ok: false; message: string };

const isProductType = (value: string): value is ProductType =>
  (PRODUCT_TYPES as readonly string[]).includes(value);

/**
 * BFF 가 받은 쿼리를 검증한다. 같은 이름이 여러 번 오면 첫 값만 보고, 모르는 파라미터는 무시한다.
 * 성공하면 keyword 는 trim 된 값이다. 실패 문구는 사용자에게 보여도 되는 한국어다.
 */
export function parseProductsSearchParams(params: URLSearchParams): ParsedProductsQuery {
  const keyword = (params.get('keyword') ?? '').trim();
  if (keyword.length > PRODUCT_KEYWORD_MAX_LENGTH) {
    return { ok: false, message: `검색어는 ${PRODUCT_KEYWORD_MAX_LENGTH}자 이하로 입력해 주세요.` };
  }

  const rawType = params.get('type') ?? '';
  if (rawType === '') return { ok: true, query: { keyword, type: null } };
  if (!isProductType(rawType)) {
    return { ok: false, message: `type 은 ${PRODUCT_TYPES.join(' 또는 ')}여야 합니다.` };
  }
  return { ok: true, query: { keyword, type: rawType } };
}
