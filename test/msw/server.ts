import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** 테스트 전체가 공유하는 MSW 서버. 덮어쓰기는 `server.use(...)`, 복구는 test/setup.ts 가 한다. */
export const server = setupServer(...handlers);
