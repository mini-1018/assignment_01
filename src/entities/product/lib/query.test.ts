import { describe, expect, it } from 'vitest';
import { escapeLikePattern, isNetworkError, toError } from './query';

describe('escapeLikePattern', () => {
  it('LIKE 와일드카드 %는 백슬래시로 이스케이프한다', () => {
    expect(escapeLikePattern('50%')).toBe('50\\%');
  });

  it('LIKE 한 글자 와일드카드 _는 백슬래시로 이스케이프한다', () => {
    expect(escapeLikePattern('a_b')).toBe('a\\_b');
  });

  it('이스케이프 문자 \\ 자체도 이스케이프한다', () => {
    expect(escapeLikePattern('a\\b')).toBe('a\\\\b');
  });

  it('PostgREST가 %로 바꾸는 *도 이스케이프한다', () => {
    expect(escapeLikePattern('a*b')).toBe('a\\*b');
  });

  it('특수 문자가 여러 개 섞여도 각각 이스케이프한다', () => {
    expect(escapeLikePattern('%_\\*')).toBe('\\%\\_\\\\\\*');
  });

  it('일반 영문·숫자·공백·기호는 그대로 둔다', () => {
    expect(escapeLikePattern('Hidden Kice 2026 (시즌7)!')).toBe('Hidden Kice 2026 (시즌7)!');
  });

  it('한글은 그대로 둔다', () => {
    expect(escapeLikePattern('국어 패스')).toBe('국어 패스');
  });

  it('빈 문자열은 빈 문자열이다', () => {
    expect(escapeLikePattern('')).toBe('');
  });
});

describe('toError', () => {
  const postgrestError = {
    message: 'relation "public.products" does not exist',
    code: '42P01',
    details: null,
    hint: null,
  };

  it('PostgrestError 형태의 일반 객체를 Error 인스턴스로 바꾼다', () => {
    expect(toError(postgrestError)).toBeInstanceOf(Error);
  });

  it('message 끝에 code를 괄호로 붙인다', () => {
    expect(toError(postgrestError).message).toBe('relation "public.products" does not exist (42P01)');
  });

  it('원본 오류 객체를 cause로 그대로 보존한다', () => {
    expect(toError(postgrestError).cause).toBe(postgrestError);
  });

  it('message가 비어 있으면 대체 문구에 code를 붙인다', () => {
    expect(toError({ message: '', code: 'PGRST000' }).message).toBe(
      '상품 목록 조회에 실패했습니다. (PGRST000)',
    );
  });

  it('message와 code가 모두 없으면 대체 문구만 쓴다', () => {
    expect(toError({}).message).toBe('상품 목록 조회에 실패했습니다.');
  });
});

describe('isNetworkError', () => {
  // postgrest-js 가 fetch reject 때 돌려주는 error 형태(code 는 빈 문자열, message 는 `${name}: ${message}`).
  const fetchFailure = (message: string) => ({ message, code: '', details: '', hint: '' });

  it.each([
    ['Chrome', 'TypeError: Failed to fetch'],
    ['Firefox', 'TypeError: NetworkError when attempting to fetch resource.'],
    ['Safari', 'TypeError: Load failed'],
    ['Node(undici)', 'TypeError: fetch failed'],
  ])('%s 의 fetch 실패를 toError 로 감싼 Error 는 연결 문제다', (_, message) => {
    expect(isNetworkError(toError(fetchFailure(message)))).toBe(true);
  });

  it('PostgREST 오류 응답(code 가 PGRST…)은 연결 문제가 아니다', () => {
    expect(isNetworkError(toError({ message: 'Could not connect to database', code: 'PGRST000' }))).toBe(false);
  });

  it('SQLSTATE code 가 있는 DB 오류는 연결 문제가 아니다', () => {
    expect(isNetworkError(toError({ message: 'relation does not exist', code: '42P01' }))).toBe(false);
  });

  it('JSON 이 아닌 오류 본문(code 없음)은 연결 문제가 아니다', () => {
    expect(isNetworkError(toError({ message: 'TypeError: <html>bad gateway</html>' }))).toBe(false);
  });

  it('요청 취소(AbortError)는 code 가 빈 값이어도 연결 문제가 아니다', () => {
    expect(isNetworkError(toError(fetchFailure('AbortError: signal is aborted without reason')))).toBe(false);
  });

  it('code 는 빈 값이지만 message 가 TypeError 로 시작하지 않으면 연결 문제가 아니다', () => {
    expect(isNetworkError(toError(fetchFailure('')))).toBe(false);
  });

  it('cause 가 없는 Error 는 연결 문제가 아니다', () => {
    expect(isNetworkError(new Error('TypeError: Failed to fetch'))).toBe(false);
  });

  it('Error 가 아닌 값(null, undefined, 문자열, 감싸지 않은 원본 객체)은 연결 문제가 아니다', () => {
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
    expect(isNetworkError('TypeError: Failed to fetch')).toBe(false);
    expect(isNetworkError(fetchFailure('TypeError: Failed to fetch'))).toBe(false);
  });
});
