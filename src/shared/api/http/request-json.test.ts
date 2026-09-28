import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { ApiError, isApiErrorBody, isNetworkError, NetworkError } from './api-error';
import { requestJson } from './request-json';

// 이 모듈은 도메인을 모르므로 임시 엔드포인트로 확인한다(jsdom 은 상대 URL 을 location 기준으로 푼다).
const ENDPOINT = '*/api/x';

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('예외가 발생하지 않았다.');
}

describe('requestJson', () => {
  it('2xx JSON 이면 본문을 그대로 돌려준다(상대 URL 도 된다)', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.json({ items: [1, 2] })));
    await expect(requestJson('/api/x')).resolves.toEqual({ items: [1, 2] });
  });

  it('오류 본문이 ApiErrorBody 면 status·code·message 를 가진 ApiError 를 던진다', async () => {
    const body = { error: { code: 'UPSTREAM_ERROR', message: '상품 정보를 불러오지 못했습니다.' } };
    server.use(http.get(ENDPOINT, () => HttpResponse.json(body, { status: 502 })));

    const error = await catchError(requestJson('/api/x'));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ name: 'ApiError', status: 502, code: 'UPSTREAM_ERROR', cause: body });
    expect((error as Error).message).toBe('상품 정보를 불러오지 못했습니다. (UPSTREAM_ERROR)');
    expect(isNetworkError(error)).toBe(false);
  });

  it('오류 본문이 JSON 이 아니면(게이트웨이 HTML) code 는 HTTP_상태 다', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.html('<html>bad gateway</html>', { status: 504 })));

    const error = await catchError(requestJson('/api/x'));
    expect(error).toMatchObject({ status: 504, code: 'HTTP_504', message: '요청에 실패했습니다. (HTTP_504)' });
  });

  it('오류 본문이 JSON 이지만 형태가 다르면 code 는 HTTP_상태 다', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.json({ message: 'x', code: 'PGRST000' }, { status: 500 })));

    const error = await catchError(requestJson('/api/x'));
    expect(error).toMatchObject({ status: 500, code: 'HTTP_500' });
  });

  it('2xx 인데 JSON 이 아니면 INVALID_RESPONSE ApiError 를 던진다', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.text('not json')));

    const error = await catchError(requestJson('/api/x'));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 200, code: 'INVALID_RESPONSE' });
  });

  it('fetch 자체가 실패하면 원인을 cause 로 가진 NetworkError 를 던지고 isNetworkError 가 true 다', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.error()));

    const error = await catchError(requestJson('/api/x'));
    expect(error).toBeInstanceOf(NetworkError);
    expect(error).toMatchObject({ name: 'NetworkError', message: '서버에 연결하지 못했습니다.' });
    expect((error as Error).cause).toBeInstanceOf(TypeError);
    expect(isNetworkError(error)).toBe(true);
  });

  it('요청을 취소하면 AbortError 를 그대로 던진다(NetworkError 로 바꾸지 않는다)', async () => {
    server.use(http.get(ENDPOINT, () => new Promise<never>(() => {})));
    const controller = new AbortController();
    const pending = catchError(requestJson('/api/x', { signal: controller.signal }));
    controller.abort();

    const error = await pending;
    expect((error as { name?: string }).name).toBe('AbortError');
    expect(error).not.toBeInstanceOf(NetworkError);
    expect(isNetworkError(error)).toBe(false);
  });
});

describe('isNetworkError', () => {
  it('NetworkError 만 연결 문제다', () => {
    expect(isNetworkError(new NetworkError())).toBe(true);
    expect(isNetworkError(new ApiError({ status: 503, code: 'UPSTREAM_UNAVAILABLE', message: 'x' }))).toBe(false);
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(false);
    expect(isNetworkError(new Error('TypeError: Failed to fetch'))).toBe(false);
  });

  it('Error 가 아닌 값(null, undefined, 문자열, 일반 객체)은 연결 문제가 아니다', () => {
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
    expect(isNetworkError('TypeError: Failed to fetch')).toBe(false);
    expect(isNetworkError({ name: 'NetworkError', message: '서버에 연결하지 못했습니다.' })).toBe(false);
  });
});

describe('isApiErrorBody', () => {
  it('error.code 와 error.message 가 모두 문자열이면 참이다', () => {
    expect(isApiErrorBody({ error: { code: 'X', message: 'y' } })).toBe(true);
  });

  it('형태가 다르면 거짓이다', () => {
    expect(isApiErrorBody(null)).toBe(false);
    expect(isApiErrorBody('error')).toBe(false);
    expect(isApiErrorBody({})).toBe(false);
    expect(isApiErrorBody({ error: null })).toBe(false);
    expect(isApiErrorBody({ error: 'x' })).toBe(false);
    expect(isApiErrorBody({ error: { code: 1, message: 'y' } })).toBe(false);
    expect(isApiErrorBody({ error: { code: 'X' } })).toBe(false);
    expect(isApiErrorBody({ code: 'PGRST000', message: 'Could not connect' })).toBe(false);
  });
});
