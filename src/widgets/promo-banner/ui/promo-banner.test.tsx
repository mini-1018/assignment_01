import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PromoBanner } from './promo-banner';

const BANNER_ALT = '히든카이스 - 모두가 푸는 건 이유가 있습니다. 상위권이 선택한 문제집, 결과로 증명된 실전 대비서';

/** next/image 의 로더 URL(/_next/image?url=...&w=...)에서 원본 주소를 꺼낸다. */
function originalImageSrc(img: HTMLElement): string | null {
  const src = img.getAttribute('src') ?? '';
  return new URL(src, 'http://localhost').searchParams.get('url');
}

describe('PromoBanner', () => {
  it('배너 이미지는 Storage 공개 버킷의 banners/promo-banner-1.png 를 쓴다', () => {
    render(<PromoBanner />);

    expect(originalImageSrc(screen.getByRole('img', { name: BANNER_ALT }))).toBe(
      'https://test.supabase.co/storage/v1/object/public/images/banners/promo-banner-1.png',
    );
  });

  it('배너 문구는 이미지에만 있으므로 장식으로 숨기지 않고 핵심 문구를 alt 로 알린다', () => {
    const { container } = render(<PromoBanner />);

    // 이미지 밖의 텍스트는 슬라이드 인디케이터(1/5)뿐이다. 이미지를 장식(alt="")으로 두면 문구가 전달되지 않는다.
    expect(container).toHaveTextContent(/^1\/5$/);
    expect(screen.queryAllByRole('presentation')).toHaveLength(0);
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('img')).toHaveAccessibleName(BANNER_ALT);
  });

  it('슬라이드 위치를 현재/전체로 보여준다', () => {
    const { container } = render(<PromoBanner current={2} total={5} />);
    expect(container).toHaveTextContent(/^2\/5$/);
  });
});
