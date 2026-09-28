'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/http';

/**
 * 조회 재시도 정책. 입력 오류(4xx)는 다시 보내도 결과가 같으므로 재시도하지 않고, 그 밖의 오류는 1회만 재시도한다.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 1;
}

/**
 * QueryClient 는 useState 로 한 번만 만든다.
 * 모듈 최상위에서 만들면 서버 렌더 시 사용자 간 캐시가 공유될 수 있다.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: shouldRetryQuery,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
