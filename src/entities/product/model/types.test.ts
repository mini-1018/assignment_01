import { describe, expect, it } from 'vitest';
import { productFixtures } from '@/test/fixtures/products';
import { formatPrice, hasDiscount, type Product } from './types';

const base: Product = { ...productFixtures[1], image_url: 'https://example.com/a.png' };

describe('formatPrice', () => {
  it('천 단위 구분 기호와 "원"을 붙인다', () => {
    expect(formatPrice(76000)).toBe('76,000원');
    expect(formatPrice(1234567)).toBe('1,234,567원');
  });

  it('천 미만과 0은 구분 기호 없이 표기한다', () => {
    expect(formatPrice(500)).toBe('500원');
    expect(formatPrice(0)).toBe('0원');
  });
});

describe('hasDiscount', () => {
  it('할인가와 할인율이 모두 있으면 할인 상품이다', () => {
    expect(hasDiscount({ ...base, sale_price: 64800, discount_rate: 5 })).toBe(true);
  });

  it('할인가와 할인율이 모두 없으면 할인 상품이 아니다', () => {
    expect(hasDiscount({ ...base, sale_price: null, discount_rate: null })).toBe(false);
  });

  it('할인가만 있고 할인율이 없으면 할인 상품으로 보지 않는다', () => {
    expect(hasDiscount({ ...base, sale_price: 64800, discount_rate: null })).toBe(false);
  });

  it('할인율만 있고 할인가가 없으면 할인 상품으로 보지 않는다', () => {
    expect(hasDiscount({ ...base, sale_price: null, discount_rate: 5 })).toBe(false);
  });

  it('할인율이 0이어도 짝이 맞으면 할인 상품으로 판정한다(null 여부만 본다)', () => {
    expect(hasDiscount({ ...base, sale_price: 76000, discount_rate: 0 })).toBe(true);
  });
});
