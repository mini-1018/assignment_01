import { describe, expect, it } from 'vitest';
import { SupabaseQueryError, toSupabaseQueryError } from './errors.server';

describe('toSupabaseQueryError', () => {
  it('HTTP 상태가 있는 PostgREST 오류는 rejected 이고 code 를 남긴다', () => {
    const raw = { message: 'Could not connect to database', code: 'PGRST000' };
    const error = toSupabaseQueryError(raw, 503);

    expect(error).toBeInstanceOf(SupabaseQueryError);
    expect(error).toMatchObject({ kind: 'rejected', code: 'PGRST000', status: 503, cause: raw });
    expect(error.message).toBe('Could not connect to database (PGRST000)');
  });

  it.each([
    ['TypeError: fetch failed'],
    ['TypeError: Failed to fetch'],
    // 문구에 abort 가 들어 있어도 접두사가 아니면 연결 실패다.
    ['Error: request AbortError: x'],
  ])('status 0 이고 %s 면 unavailable 이다', (message) => {
    expect(toSupabaseQueryError({ message, code: '' }, 0).kind).toBe('unavailable');
  });

  it.each([
    ['AbortError: This operation was aborted'],
    ['TimeoutError: The operation was aborted due to timeout'],
  ])('status 0 이고 %s 면 timeout 이다', (message) => {
    expect(toSupabaseQueryError({ message, code: '' }, 0).kind).toBe('timeout');
  });

  it('status 가 0 이 아니면 문구가 AbortError 로 시작해도 rejected 다', () => {
    expect(toSupabaseQueryError({ message: 'AbortError: x', code: 'PGRST000' }, 500).kind).toBe('rejected');
  });

  it('message·code 가 없어도 Error 문구를 만든다', () => {
    expect(toSupabaseQueryError({}, 500).message).toBe('Supabase 조회 실패');
  });
});
