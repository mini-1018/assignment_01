import 'server-only';

/**
 * Supabase 조회 실패의 종류.
 * - `rejected`: Supabase(PostgREST)가 오류로 응답했다(HTTP 상태가 있음).
 * - `unavailable`: 서버가 Supabase 에 닿지 못했다(fetch reject, 취소 아님).
 * - `timeout`: 요청을 시간 초과·취소로 끊었다.
 */
export type SupabaseQueryErrorKind = 'rejected' | 'unavailable' | 'timeout';

/**
 * 서버 쪽 Supabase 조회 오류. 원본(PostgREST code·message·details·hint)은 `cause` 에만 둔다.
 * HTTP 응답 본문에 넣지 않는다. 호출한 쪽(라우트)이 `kind` 로 상태 코드를 고른다.
 */
export class SupabaseQueryError extends Error {
  override readonly name = 'SupabaseQueryError';
  readonly kind: SupabaseQueryErrorKind;
  /** PostgREST code(`PGRST…`, SQLSTATE). fetch 가 reject 되면 빈 문자열이다. */
  readonly code: string;
  /** PostgREST 가 준 HTTP 상태. fetch 가 reject 되면 0 이다. */
  readonly status: number;

  constructor(init: { kind: SupabaseQueryErrorKind; code: string; status: number; message: string; cause: unknown }) {
    super(init.message, { cause: init.cause });
    this.kind = init.kind;
    this.code = init.code;
    this.status = init.status;
  }
}

const ABORT_PREFIXES = ['AbortError:', 'TimeoutError:'];

/**
 * supabase-js 의 `{ error, status }` 를 `SupabaseQueryError` 로 바꾼다.
 *
 * 근거(postgrest-js 2.117.2 `PostgrestBuilder.then`): fetch 가 reject 되면 예외 대신
 * `{ error: { message: `${name}: ${message}`, code: '' }, status: 0 }` 를 준다. 취소는 `AbortError`,
 * `AbortSignal.timeout` 은 `TimeoutError` 다. 그래서 문구보다 `status === 0` 을 먼저 본다.
 */
export function toSupabaseQueryError(
  error: { message?: string; code?: string },
  status: number,
): SupabaseQueryError {
  const message = error.message ?? '';
  const code = error.code ?? '';
  let kind: SupabaseQueryErrorKind = 'rejected';
  if (status === 0) {
    kind = ABORT_PREFIXES.some((prefix) => message.startsWith(prefix)) ? 'timeout' : 'unavailable';
  }
  return new SupabaseQueryError({
    kind,
    code,
    status,
    message: code ? `${message || 'Supabase 조회 실패'} (${code})` : message || 'Supabase 조회 실패',
    cause: error,
  });
}
