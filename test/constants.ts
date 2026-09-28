/** vitest.config.mts 의 test.env(SUPABASE_URL) 와 같은 값이어야 한다. */
export const TEST_SUPABASE_URL = 'https://test.supabase.co';

/** 서버 층(node): supabase-js 가 부르는 PostgREST 엔드포인트. */
export const SUPABASE_PRODUCTS_ENDPOINT = `${TEST_SUPABASE_URL}/rest/v1/products`;

/**
 * 브라우저 층(jsdom): 훅이 부르는 BFF 엔드포인트. 호스트에 기대지 않도록 `*` 로 받는다.
 * jsdom 의 상대 URL `fetch('/api/products')` 는 location.href(http://localhost:3000/) 기준으로 풀린다.
 */
export const BFF_PRODUCTS_URL = '*/api/products';

/** `images` 버킷 공개 URL 접두사(getStorageImageUrl 결과). */
export const TEST_PUBLIC_IMAGE_BASE = `${TEST_SUPABASE_URL}/storage/v1/object/public/images`;
