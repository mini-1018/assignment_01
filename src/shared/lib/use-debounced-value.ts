'use client';

import { useEffect, useState } from 'react';

/**
 * 값이 delay 동안 바뀌지 않았을 때만 반영한다.
 * 검색어를 그대로 queryKey 에 넣으면 타이핑 한 글자마다 요청이 나가므로 반드시 거쳐서 쓴다.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
