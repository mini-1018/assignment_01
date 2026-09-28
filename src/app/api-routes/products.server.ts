import 'server-only';
import type { ProductsResponse } from '@/entities/product';
import { getProducts, parseProductsSearchParams } from '@/entities/product/index.server';
import type { ApiErrorBody } from '@/shared/api/http';
import { SupabaseQueryError } from '@/shared/api/supabase/index.server';

/** 서버 → Supabase 요청을 끊는 시간(ms). Vercel 함수 제한보다 짧게 끊어 504 를 직접 준다. */
export const UPSTREAM_TIMEOUT_MS = 5000;

/**
 * 200 은 브라우저가 매번 확인하고(TanStack Query 가 캐시를 소유), CDN 은 쿼리 문자열별로 60초 공유한다.
 * 오류는 CDN 에 남으면 복구된 뒤에도 보이므로 저장하지 않는다.
 */
const CACHE_OK = 'public, max-age=0, s-maxage=60, stale-while-revalidate=60';
const CACHE_ERROR = 'no-store';

function errorResponse(status: number, code: string, message: string): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return Response.json(body, { status, headers: { 'Cache-Control': CACHE_ERROR } });
}

const UPSTREAM_ERRORS = {
  rejected: { status: 502, code: 'UPSTREAM_ERROR', message: '상품 정보를 불러오지 못했습니다.' },
  unavailable: { status: 503, code: 'UPSTREAM_UNAVAILABLE', message: '상품 서버에 연결하지 못했습니다.' },
  timeout: { status: 504, code: 'UPSTREAM_TIMEOUT', message: '상품 서버의 응답이 늦습니다.' },
} as const;

/**
 * `GET /api/products` 핸들러를 만든다. 시간 초과는 테스트가 짧은 값을 넣을 수 있게 주입받는다
 * (`AbortSignal.timeout` 은 Vitest 가짜 타이머로 앞당겨지지 않는다).
 *
 * 오류 본문에는 사용자에게 보여도 되는 문구만 넣는다. Supabase 원문(code·message·details·hint, SQL 오류)은
 * 서버 로그에만 남긴다. 키·URL 은 로그에도 남기지 않는다.
 */
export function createProductsHandler({ timeoutMs }: { timeoutMs: number }) {
  return async function GET(request: Request): Promise<Response> {
    const parsed = parseProductsSearchParams(new URL(request.url).searchParams);
    if (!parsed.ok) return errorResponse(400, 'INVALID_QUERY', parsed.message);

    try {
      const items = await getProducts(parsed.query, { signal: AbortSignal.timeout(timeoutMs) });
      const body: ProductsResponse = { items };
      return Response.json(body, { headers: { 'Cache-Control': CACHE_OK } });
    } catch (error) {
      if (error instanceof SupabaseQueryError) {
        console.error('[api/products] Supabase 조회 실패', {
          kind: error.kind,
          status: error.status,
          code: error.code,
          message: error.message,
        });
        const { status, code, message } = UPSTREAM_ERRORS[error.kind];
        return errorResponse(status, code, message);
      }
      console.error('[api/products] 처리 중 오류', error instanceof Error ? error.message : error);
      return errorResponse(500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다.');
    }
  };
}

export const GET = createProductsHandler({ timeoutMs: UPSTREAM_TIMEOUT_MS });
