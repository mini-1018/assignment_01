import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { productFixtures } from '@/test/fixtures/products';
import type { Product } from '../model/types';
import { ProductCard } from './product-card';

const PUBLIC_BASE = 'https://test.supabase.co/storage/v1/object/public/images';

/** fixtures 행을 훅이 돌려주는 모양(image_url = 공개 URL)으로 바꾼다. */
function toProduct(title: string): Product {
  const row = productFixtures.find((p) => p.title === title);
  if (!row) throw new Error(`fixtures 에 없는 상품: ${title}`);
  return { ...row, image_url: `${PUBLIC_BASE}/${row.image_url}` };
}

const PASS = toProduct('2026 Hidden Kice 국어 패스'); // 76,000원 → 5% → 64,800원
const SINGLE = toProduct('2026 Hidden Kice 시즌7'); // 40,000원, 할인 없음

/** 보조기기가 읽는 순서의 글자(sr-only 포함). 공백은 하나로 모은다. */
const spoken = (el: HTMLElement) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

function renderCard(product: Product) {
  render(<ProductCard product={product} />);
  return screen.getByRole('article', { name: product.title });
}

describe('ProductCard', () => {
  it('상품명은 h3 heading 이고, 카드(article)는 그 상품명을 이름으로 찾을 수 있다', () => {
    const card = renderCard(PASS);

    const heading = within(card).getByRole('heading', { level: 3, name: PASS.title });
    expect(card).toContainElement(heading);
  });

  it('이미지는 장식으로 처리돼 img 로 잡히지 않는다(상품명이 두 번 읽히지 않는다)', () => {
    const card = renderCard(PASS);

    expect(within(card).queryAllByRole('img')).toHaveLength(0);
    expect(within(card).getByRole('presentation')).toHaveAttribute('alt', '');
  });

  it('할인 상품은 정가(삭제)·할인율·할인가(삽입)를 구분해 읽힌다', () => {
    const card = renderCard(PASS);

    expect(within(card).getByRole('deletion')).toHaveTextContent(/^76,000원$/);
    expect(within(card).getByRole('insertion')).toHaveTextContent(/^64,800원$/);

    const text = spoken(card);
    expect(text).toContain('정가 76,000원');
    expect(text).toContain('할인율 5%');
    expect(text).toContain('할인가 64,800원');
    // 읽는 순서: 정가 → 할인율 → 할인가
    expect(text.indexOf('정가')).toBeLessThan(text.indexOf('할인율'));
    expect(text.indexOf('할인율')).toBeLessThan(text.indexOf('할인가'));
    expect(text).not.toContain('가격 ');
  });

  it('할인이 없는 단품은 "가격"으로만 읽히고 정가·할인 표기는 없다', () => {
    const card = renderCard(SINGLE);

    expect(spoken(card)).toContain('가격 40,000원');
    expect(within(card).queryByRole('deletion')).not.toBeInTheDocument();
    expect(within(card).queryByRole('insertion')).not.toBeInTheDocument();
    expect(within(card).queryByText(/정가|할인/)).not.toBeInTheDocument();
    expect(within(card).queryByText(/%$/)).not.toBeInTheDocument();
  });
});
