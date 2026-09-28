import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // server-only 의 기본 조건(index.js)은 import 하자마자 던진다. Vitest 는 react-server 조건으로
      // 해석하지 않으므로 빈 모듈로 바꾼다. resolve.conditions 에 react-server 를 넣으면 React 까지
      // 서버 빌드로 바뀌어 RTL 이 깨지므로 쓰지 않는다.
      { find: /^server-only$/, replacement: fromRoot('./node_modules/server-only/empty.js') },
      // tsconfig.json 의 paths 와 같은 규칙. 더 구체적인 `@/test/` 를 먼저 둔다.
      { find: /^@\/test\//, replacement: `${fromRoot('./test')}/` },
      { find: /^@\//, replacement: `${fromRoot('./src')}/` },
    ],
  },
  test: {
    // 테스트 전용 가짜 값. src/shared/config/env.server.ts 는 값이 없으면 예외를 던진다.
    // Vitest 는 .env.local 을 process.env 에 넣지 않으며, 셸에 실제 값이 있어도 여기서 덮어쓴다.
    // 요청은 전부 MSW 가 가로채고, 처리되지 않은 요청은 오류로 끝난다(test/setup*.ts).
    env: {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    },
    projects: [
      {
        extends: true,
        test: {
          // 브라우저 층: 훅·위젯·뷰. MSW 는 BFF(`*/api/products`)를 가로챈다.
          name: 'client',
          environment: 'jsdom',
          setupFiles: ['./test/setup.ts'],
          include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
          exclude: ['src/**/*.server.test.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          // 서버 층: *.server.ts 와 라우트. MSW 는 Supabase REST 를 가로챈다.
          name: 'server',
          environment: 'node',
          setupFiles: ['./test/setup.server.ts'],
          include: ['src/**/*.server.test.{ts,tsx}'],
          // Node 25+ 는 Web Storage 가 기본으로 켜져 있어, MSW 쿠키 저장소가 localStorage 를 확인할 때마다
          // ExperimentalWarning(--localstorage-file 없음)을 낸다. 서버 코드는 localStorage 를 쓰지 않으므로 끈다.
          execArgv: ['--no-experimental-webstorage'],
        },
      },
    ],
  },
});
