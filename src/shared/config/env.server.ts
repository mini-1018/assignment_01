import 'server-only';

/**
 * 서버 전용 환경 변수. `NEXT_PUBLIC_` 접두사가 없어 브라우저 번들에 들어가지 않는다.
 *
 * - 모듈 최상위에서 던지지 않고 호출할 때 읽는다. 라우트는 이 예외를 500(INTERNAL_ERROR)으로 바꾼다.
 *   배너(서버 컴포넌트)는 홈 프리렌더 때 부르므로 값이 없으면 `next build` 가 멈춘다.
 * - 키는 publishable 키다. RLS(anon select 정책)를 그대로 거친다. secret 키는 쓰지 않는다.
 */
export function getServerEnv(): { supabaseUrl: string; supabaseKey: string } {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase 환경 변수가 없습니다. .env.local(또는 Vercel 환경 변수)에 SUPABASE_URL 과 ' +
        'SUPABASE_PUBLISHABLE_KEY 를 설정하고 서버를 다시 시작하세요.',
    );
  }

  return { supabaseUrl, supabaseKey };
}
