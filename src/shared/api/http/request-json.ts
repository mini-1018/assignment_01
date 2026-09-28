import { ApiError, isApiErrorBody, NetworkError } from './api-error';

async function readJson(response: Response): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await response.json() };
  } catch {
    return { ok: false };
  }
}

/**
 * 같은 출처의 JSON API(BFF)를 부른다. 오류는 모두 `Error` 인스턴스로 던진다.
 *
 * | 경우 | 결과 |
 * | fetch reject, AbortError(취소) | 그대로 다시 던진다(TanStack 이 취소로 처리) |
 * | fetch reject, 그 밖(TypeError) | `NetworkError`. 브라우저별 문구에 기대지 않는다 |
 * | 2xx 아님, 본문이 ApiErrorBody | `ApiError(status, body.error.code, body.error.message)` |
 * | 2xx 아님, 본문이 다름(HTML 등) | `ApiError(status, 'HTTP_${status}', '요청에 실패했습니다.')` |
 * | 2xx, JSON 파싱 실패 | `ApiError(status, 'INVALID_RESPONSE', '응답을 해석하지 못했습니다.')` |
 * | 2xx, JSON | 그대로 반환(형태 검사는 호출한 쪽이 한다) |
 */
export async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    // DOMException 이 Error 를 상속하지 않는 환경도 있어 name 만 본다.
    if ((error as { name?: unknown } | null)?.name === 'AbortError') throw error;
    throw new NetworkError({ cause: error });
  }

  const body = await readJson(response);

  if (!response.ok) {
    const { status } = response;
    if (body.ok && isApiErrorBody(body.value)) {
      const { code, message } = body.value.error;
      throw new ApiError({ status, code, message, cause: body.value });
    }
    throw new ApiError({ status, code: `HTTP_${status}`, message: '요청에 실패했습니다.' });
  }

  if (!body.ok) {
    throw new ApiError({ status: response.status, code: 'INVALID_RESPONSE', message: '응답을 해석하지 못했습니다.' });
  }
  return body.value as T;
}
