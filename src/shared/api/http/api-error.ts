/** BFF 오류 응답 본문. `message` 는 사용자에게 보여도 되는 문구다(외부 서비스 원문 없음). */
export type ApiErrorBody = { error: { code: string; message: string } };

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  const error: unknown = (value as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return typeof code === 'string' && typeof message === 'string';
}

/**
 * BFF 가 응답했지만 2xx 가 아니거나, 2xx 인데 본문이 계약과 다르다.
 * `message` 는 `문구 (code)` 형식이다(화면이 그대로 보여 준다).
 */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  /** HTTP 상태 */
  readonly status: number;
  /** 본문 error.code. 본문이 없거나 다르면 `HTTP_${status}`, 2xx 인데 해석할 수 없으면 `INVALID_RESPONSE` */
  readonly code: string;

  constructor(init: { status: number; code: string; message: string; cause?: unknown }) {
    super(`${init.message} (${init.code})`, { cause: init.cause });
    this.status = init.status;
    this.code = init.code;
  }
}

/** 브라우저가 BFF 에 닿지 못했다(fetch 가 TypeError 로 reject). */
export class NetworkError extends Error {
  override readonly name = 'NetworkError';

  constructor(options?: { cause?: unknown }) {
    super('서버에 연결하지 못했습니다.', { cause: options?.cause });
  }
}

/**
 * 오류가 "브라우저가 서버에 닿지 못한 실패"(사용자 쪽 연결 문제)인지 판별한다.
 * BFF 가 Supabase 에 닿지 못한 503 은 `ApiError` 라 해당하지 않는다(사용자 연결 문제가 아니다).
 */
export function isNetworkError(error: unknown): boolean {
  return error instanceof NetworkError;
}
