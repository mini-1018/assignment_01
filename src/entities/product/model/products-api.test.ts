import { describe, expect, it } from 'vitest';
import {
  parseProductsSearchParams,
  PRODUCT_KEYWORD_MAX_LENGTH,
  PRODUCT_TYPES,
  toProductsSearchParams,
} from './products-api';

describe('toProductsSearchParams', () => {
  it('조건이 없으면 빈 쿼리다', () => {
    expect(toProductsSearchParams({ keyword: '', type: null }).toString()).toBe('');
  });

  it('공백만 있는 검색어는 생략한다', () => {
    expect(toProductsSearchParams({ keyword: '   ', type: null }).has('keyword')).toBe(false);
  });

  it('검색어는 앞뒤 공백을 잘라 넣는다', () => {
    expect(toProductsSearchParams({ keyword: '  국어  ', type: null }).get('keyword')).toBe('국어');
  });

  it('유형과 검색어를 함께 넣는다', () => {
    const params = toProductsSearchParams({ keyword: '시즌7', type: '단품' });
    expect(params.get('keyword')).toBe('시즌7');
    expect(params.get('type')).toBe('단품');
  });

  it('특수 문자는 이스케이프하지 않고 URL 인코딩만 한다(이스케이프는 서버 몫)', () => {
    const params = toProductsSearchParams({ keyword: '50%_\\*&=', type: null });
    expect(params.get('keyword')).toBe('50%_\\*&=');
    expect(params.toString()).toBe('keyword=50%25_%5C*%26%3D');
  });
});

describe('parseProductsSearchParams', () => {
  const parse = (qs: string) => parseProductsSearchParams(new URLSearchParams(qs));

  it('파라미터가 없으면 전체 조회다', () => {
    expect(parse('')).toEqual({ ok: true, query: { keyword: '', type: null } });
  });

  it('빈 type 은 전체다', () => {
    expect(parse('type=')).toEqual({ ok: true, query: { keyword: '', type: null } });
  });

  it.each(PRODUCT_TYPES)('type=%s 를 받는다', (type) => {
    expect(parse(`type=${encodeURIComponent(type)}`)).toEqual({ ok: true, query: { keyword: '', type } });
  });

  it.each(['기타', '패스 ', 'PASS', 'eq.패스'])("type='%s' 는 400 문구를 준다", (type) => {
    expect(parse(`type=${encodeURIComponent(type)}`)).toEqual({
      ok: false,
      message: 'type 은 단품 또는 패스여야 합니다.',
    });
  });

  it('keyword 는 trim 한 값이다', () => {
    expect(parse('keyword=%20%20%EA%B5%AD%EC%96%B4%20')).toEqual({ ok: true, query: { keyword: '국어', type: null } });
  });

  it('trim 뒤 100자까지는 받는다(한글 한 글자는 1)', () => {
    const keyword = '가'.repeat(PRODUCT_KEYWORD_MAX_LENGTH);
    expect(parse(new URLSearchParams({ keyword: `  ${keyword}  ` }).toString())).toEqual({
      ok: true,
      query: { keyword, type: null },
    });
  });

  it('trim 뒤 101자면 400 문구를 준다', () => {
    const keyword = 'a'.repeat(PRODUCT_KEYWORD_MAX_LENGTH + 1);
    expect(parse(new URLSearchParams({ keyword }).toString())).toEqual({
      ok: false,
      message: '검색어는 100자 이하로 입력해 주세요.',
    });
  });

  it('같은 이름이 여러 번 오면 첫 값만 본다', () => {
    expect(parse('type=%ED%8C%A8%EC%8A%A4&type=x&keyword=a&keyword=b')).toEqual({
      ok: true,
      query: { keyword: 'a', type: '패스' },
    });
  });

  it('모르는 파라미터는 무시한다', () => {
    expect(parse('select=*&product_type=eq.x')).toEqual({ ok: true, query: { keyword: '', type: null } });
  });
});
