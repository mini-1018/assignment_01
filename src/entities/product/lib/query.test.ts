import { describe, expect, it } from 'vitest';
import { escapeLikePattern } from './query';

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
