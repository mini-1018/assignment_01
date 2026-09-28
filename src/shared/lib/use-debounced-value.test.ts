import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebouncedValue } from './use-debounced-value';

function renderDebounced(initial: string, delay?: number) {
  return renderHook(({ value }: { value: string }) => useDebouncedValue(value, delay), {
    initialProps: { value: initial },
  });
}

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('처음에는 받은 값을 그대로 돌려준다', () => {
    const { result } = renderDebounced('a');
    expect(result.current).toBe('a');
  });

  it('기본 지연은 300ms 다. 299ms 에는 이전 값, 300ms 에는 새 값이다', () => {
    const { result, rerender } = renderDebounced('a');

    rerender({ value: 'b' });
    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('b');
  });

  it('지연 중에 값이 또 바뀌면 타이머를 다시 시작하고 마지막 값만 반영한다', () => {
    const { result, rerender } = renderDebounced('a');

    rerender({ value: 'b' });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: 'c' });
    // 'b' 기준이면 이미 300ms 가 지났을 시점이지만 'c' 로 다시 시작했으므로 아직 이전 값이다.
    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('c');
  });

  it('지연 시간을 인자로 바꿀 수 있다', () => {
    const { result, rerender } = renderDebounced('a', 100);

    rerender({ value: 'b' });
    act(() => vi.advanceTimersByTime(99));
    expect(result.current).toBe('a');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('b');
  });
});
