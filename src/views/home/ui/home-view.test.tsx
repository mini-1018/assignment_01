import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithQuery } from '@/test/render';
import { HomeView } from './home-view';

describe('HomeView', () => {
  it('제목 계층이 h1 스토어 → h2 상품 목록 → h3 상품명 순이다', async () => {
    renderWithQuery(<HomeView />);

    await waitFor(() => expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(12));

    const [h1, h2, ...rest] = screen.getAllByRole('heading');
    expect(screen.getAllByRole('heading', { level: 1 })).toEqual([h1]);
    expect(h1).toHaveAccessibleName('스토어');
    expect(screen.getAllByRole('heading', { level: 2 })).toEqual([h2]);
    expect(h2).toHaveAccessibleName('상품 목록');
    expect(rest).toEqual(screen.getAllByRole('heading', { level: 3 }));

    const region = screen.getByRole('region', { name: '상품 목록' });
    expect(within(region).getAllByRole('heading', { level: 3 })).toHaveLength(12);
  });
});
