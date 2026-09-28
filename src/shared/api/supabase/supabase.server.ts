import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from '@/shared/config/env.server';
import type { Database } from './types';

let client: SupabaseClient<Database> | undefined;

/**
 * 서버 전용 Supabase 클라이언트. 처음 호출할 때 한 번만 만들고 재사용한다.
 * 세션이 없는 publishable 키 조회라 요청 사이에 공유해도 된다.
 *
 * - `db.retry: false` — postgrest-js 자체 재시도(GET 의 fetch 실패·503·520 을 1s·2s·4s 간격으로 3번 더)를 끈다.
 *   재시도는 브라우저 QueryClient 한 곳에서만 한다. 이 값을 지우면 라우트·조회 테스트의 "요청 1번" 단언이 실패한다.
 * - auth 는 모두 끈다. 서버에는 저장소도 URL 세션도 없다.
 */
export function getSupabaseServerClient(): SupabaseClient<Database> {
  if (client) return client;
  const { supabaseUrl, supabaseKey } = getServerEnv();
  client = createClient<Database>(supabaseUrl, supabaseKey, {
    db: { retry: false },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
