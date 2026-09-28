import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  render,
  renderHook,
  type RenderHookOptions,
  type RenderOptions,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * 테스트용 QueryClient. src/app/providers/query-provider.tsx 의 기본 옵션을 따르되
 * 재시도를 끈다(오류 상태를 바로 확인하기 위해). 테스트마다 새로 만들어 캐시가 섞이지 않게 한다.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

function createWrapper(client: QueryClient) {
  return function TestQueryProvider({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

type QueryOptions = { queryClient?: QueryClient };

/** 새 QueryClient 로 감싸 렌더링한다. `user`(userEvent 인스턴스)와 `queryClient` 를 함께 돌려준다. */
export function renderWithQuery(
  ui: ReactElement,
  options: QueryOptions & Omit<RenderOptions, 'wrapper'> = {},
) {
  const { queryClient = createTestQueryClient(), ...rest } = options;
  const user = userEvent.setup();
  return { user, queryClient, ...render(ui, { wrapper: createWrapper(queryClient), ...rest }) };
}

/** 새 QueryClient 로 감싼 renderHook. */
export function renderHookWithQuery<Result, Props>(
  hook: (props: Props) => Result,
  options: QueryOptions & Omit<RenderHookOptions<Props>, 'wrapper'> = {},
) {
  const { queryClient = createTestQueryClient(), ...rest } = options;
  return { queryClient, ...renderHook(hook, { wrapper: createWrapper(queryClient), ...rest }) };
}
