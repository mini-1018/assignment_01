import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/shared/api/http';
import { shouldRetryQuery } from './query-provider';

const apiError = (status: number) => new ApiError({ status, code: `HTTP_${status}`, message: '오류' });

describe('shouldRetryQuery', () => {
  it('4xx 오류는 첫 실패에도 재시도하지 않는다(400·404·499)', () => {
    expect(shouldRetryQuery(0, apiError(400))).toBe(false);
    expect(shouldRetryQuery(0, apiError(404))).toBe(false);
    expect(shouldRetryQuery(0, apiError(499))).toBe(false);
  });

  it('5xx·연결 실패·그 밖의 오류는 1회만 재시도한다', () => {
    for (const error of [apiError(500), apiError(502), apiError(399), new NetworkError(), new Error('x')]) {
      expect(shouldRetryQuery(0, error)).toBe(true);
      expect(shouldRetryQuery(1, error)).toBe(false);
    }
  });
});
