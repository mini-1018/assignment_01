import { http, HttpResponse } from 'msw';
import type { ProductRow } from '@/shared/api/supabase';
import { SUPABASE_PRODUCTS_ENDPOINT } from '../constants';
import { productFixtures } from '../fixtures/products';

/**
 * 서버 층(node) MSW 핸들러. supabase-js 가 보내는 PostgREST 요청을 가로채고 쿼리스트링을 실제로 해석한다.
 * `*.server.test.ts`(조회 함수·라우트)만 쓴다. 브라우저 층(훅·위젯)은 test/msw/handlers.ts 의 BFF 핸들러를 쓴다.
 */

type Row = Record<string, unknown>;

// ─── 요청 기록 ────────────────────────────────────────────────────────────
const recorded: URL[] = [];

/** 이번 테스트에서 Supabase products 로 보낸 요청 URL 전부(오래된 순). */
export function getSupabaseProductsRequests(): readonly URL[] {
  return recorded;
}

/** 이번 테스트에서 Supabase products 로 보낸 마지막 요청 URL. 요청이 없으면 예외를 던진다. */
export function getLastSupabaseProductsRequest(): URL {
  const last = recorded.at(-1);
  if (!last) throw new Error('Supabase products 요청이 한 번도 기록되지 않았다.');
  return last;
}

/** test/msw/handlers.ts 의 clearRequestLog 가 부른다(두 층을 함께 비운다). */
export function clearSupabaseRequestLog(): void {
  recorded.length = 0;
}

function record(request: Request): URL {
  const url = new URL(request.url);
  recorded.push(url);
  return url;
}

// ─── PostgREST 쿼리스트링 해석 ─────────────────────────────────────────────
const RESERVED_PARAMS = new Set(['select', 'order', 'limit', 'offset']);
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** LIKE 패턴(PostgREST 는 `*` 를 `%` 로 취급)을 정규식으로 바꾼다. `\` 뒤 글자는 문자 그대로다. */
function likeToRegExp(pattern: string, flags: string): RegExp {
  let source = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === '\\' && i + 1 < pattern.length) {
      i += 1;
      source += escapeRegExp(pattern[i]);
    } else if (char === '%' || char === '*') source += '[\\s\\S]*';
    else if (char === '_') source += '[\\s\\S]';
    else source += escapeRegExp(char);
  }
  return new RegExp(`^${source}$`, flags);
}

function matchFilter(value: unknown, expression: string): boolean {
  const dot = expression.indexOf('.');
  const operator = expression.slice(0, dot);
  const operand = expression.slice(dot + 1);
  switch (operator) {
    case 'eq':
      return String(value) === operand;
    case 'neq':
      return String(value) !== operand;
    case 'like':
      return likeToRegExp(operand, '').test(String(value));
    case 'ilike':
      return likeToRegExp(operand, 'i').test(String(value));
    case 'is':
      return operand === 'null' ? value === null : String(value) === operand;
    default:
      throw new Error(`MSW Supabase products 핸들러가 지원하지 않는 필터 연산자: ${operator}`);
  }
}

function applyOrder(rows: Row[], order: string | null): Row[] {
  if (!order) return rows;
  const keys = order.split(',').map((part) => {
    const [column, direction = 'asc'] = part.trim().split('.');
    return { column, desc: direction === 'desc' };
  });
  return [...rows].sort((a, b) => {
    for (const { column, desc } of keys) {
      const x = a[column] as number | string;
      const y = b[column] as number | string;
      if (x === y) continue;
      return (x < y ? -1 : 1) * (desc ? -1 : 1);
    }
    return 0;
  });
}

function applySelect(rows: Row[], select: string | null): Row[] {
  if (!select || select.trim() === '*') return rows;
  const columns = select
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  return rows.map((row) => Object.fromEntries(columns.map((c) => [c, row[c]])));
}

/** fixtures(또는 주어진 행)에 요청 쿼리스트링(필터, order, select)을 실제로 적용한 결과. */
function queryRows(url: URL, source: readonly ProductRow[]): Row[] {
  let rows: Row[] = source.map((row) => ({ ...row }));
  for (const [key, expression] of url.searchParams) {
    if (RESERVED_PARAMS.has(key)) continue;
    rows = rows.filter((row) => matchFilter(row[key], expression));
  }
  rows = applyOrder(rows, url.searchParams.get('order'));
  return applySelect(rows, url.searchParams.get('select'));
}

// ─── 핸들러 ───────────────────────────────────────────────────────────────
// 모두 요청을 기록한다. `server.use(...)` 덮어쓰기는 setup 의 resetHandlers 로 테스트마다 풀린다.

/** 기본 응답. `rows`(기본 fixtures)에 쿼리스트링을 적용해 돌려준다. test/msw/handlers.ts 의 `handlers` 에 들어 있다. */
export function supabaseProductsHandler(rows: readonly ProductRow[] = productFixtures) {
  return http.get(SUPABASE_PRODUCTS_ENDPOINT, ({ request }) => {
    const url = record(request);
    return HttpResponse.json(queryRows(url, rows));
  });
}

export type PostgrestErrorBody = {
  code: string;
  message: string;
  details?: string | null;
  hint?: string | null;
};

/** PostgREST 오류 응답. 기본값은 500 PGRST000(Could not connect to database)이다. */
export function supabaseProductsErrorHandler(
  status = 500,
  body: PostgrestErrorBody = {
    code: 'PGRST000',
    message: 'Could not connect to database',
    details: null,
    hint: null,
  },
) {
  return http.get(SUPABASE_PRODUCTS_ENDPOINT, ({ request }) => {
    record(request);
    return HttpResponse.json(body, { status });
  });
}

/**
 * 서버 → Supabase 연결 자체가 실패한다(`fetch` 가 TypeError 로 reject).
 * 서버 클라이언트는 `db.retry: false` 라 요청은 1번이고 가짜 타이머가 필요 없다.
 */
export function supabaseProductsNetworkErrorHandler() {
  return http.get(SUPABASE_PRODUCTS_ENDPOINT, ({ request }) => {
    record(request);
    return HttpResponse.error();
  });
}

/**
 * `release()` 를 부를 때까지 응답을 붙잡는다. 풀지 않으면 끝까지 응답하지 않는다(시간 초과 확인용).
 * 요청은 받는 즉시 기록된다. 요청이 취소(abort)되면 MSW 가 fetch 를 그 이유로 reject 한다.
 */
export function supabaseProductsHeldHandler(rows: readonly ProductRow[] = productFixtures) {
  let open: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  const handler = http.get(SUPABASE_PRODUCTS_ENDPOINT, async ({ request }) => {
    const url = record(request);
    await gate;
    return HttpResponse.json(queryRows(url, rows));
  });
  return { handler, release: () => open() };
}
