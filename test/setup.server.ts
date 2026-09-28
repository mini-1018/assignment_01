import { afterAll, afterEach, beforeAll } from 'vitest';
import { clearRequestLog } from './msw/handlers';
import { server } from './msw/server';

/**
 * 서버 층(node 환경) setup. `*.server.test.ts` 만 이 파일을 쓴다(vitest.config.mts 의 server 프로젝트).
 * DOM 이 없으므로 Testing Library 를 import 하지 않는다.
 */

// 처리되지 않은 요청(실제 원격 Supabase 포함)은 전부 오류로 만든다.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  server.resetHandlers();
  clearRequestLog();
});

afterAll(() => server.close());
