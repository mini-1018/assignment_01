import type { NextConfig } from 'next';

/**
 * Supabase Storage 공개 버킷 `images`만 next/image 원격 소스로 허용한다.
 * 호스트는 하드코딩하지 않고 SUPABASE_URL에서 뽑는다(로컬 스택의 http/포트도 그대로 따른다).
 *
 * 환경 변수가 없을 때: 여기서는 예외를 던지지 않고 경고만 남긴 채 원격 패턴을 등록하지 않는다.
 * - 이 파일은 `next dev`/`next build`/`next start` 등 모든 next 명령에서 읽히므로, 여기서 던지면
 *   원인 안내가 담긴 src/shared/config/env.ts의 오류보다 먼저 덜 친절한 오류로 멈춘다.
 * - 값이 없으면 앱은 어차피 env.ts에서 예외를 던져(빌드 시 프리렌더 포함) 조용히 배포되지 않는다.
 * - 값이 있는데 URL 형식이 아니면 new URL()이 던지도록 둔다. 오타는 빨리 드러나는 편이 낫다.
 */
function supabaseStoragePattern() {
  const raw = process.env.SUPABASE_URL;
  if (!raw) {
    console.warn(
      '[next.config] SUPABASE_URL이 없어 Supabase Storage 이미지 원격 패턴을 등록하지 않았습니다.',
    );
    return [];
  }

  const url = new URL(raw);
  return [
    {
      protocol: url.protocol.replace(':', '') as 'http' | 'https',
      hostname: url.hostname,
      port: url.port,
      pathname: '/storage/v1/object/public/images/**',
    },
  ];
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseStoragePattern(),
  },
};

export default nextConfig;
