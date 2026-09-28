import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { clearRequestLog } from './msw/handlers';
import { server } from './msw/server';

// 처리되지 않은 요청(실제 원격 Supabase 포함)은 전부 오류로 만든다.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  // vitest globals 를 켜지 않았으므로 RTL 자동 cleanup 이 동작하지 않는다. 직접 호출한다.
  cleanup();
  server.resetHandlers();
  clearRequestLog();
});

afterAll(() => server.close());
