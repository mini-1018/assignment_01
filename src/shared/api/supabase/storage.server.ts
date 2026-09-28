import 'server-only';
import { getSupabaseServerClient } from './supabase.server';

/** 상품·배너 이미지를 담는 public 버킷(supabase/migrations/20260928010000_storage_images.sql). */
export const STORAGE_IMAGES_BUCKET = 'images';

/**
 * `images` 버킷 안의 객체 경로(예: `products/hidden-kice-pass.png`)를 화면에 쓸 공개 URL로 바꾼다.
 *
 * - DB 에는 객체 경로만 저장한다. 프로젝트가 바뀌어도 데이터를 그대로 쓰기 위해서다.
 * - getPublicUrl 은 URL 문자열을 조립할 뿐 네트워크 요청을 보내지 않는다.
 * - 앞에 붙은 `/` 는 제거한다(`/products/a.png` → `products/a.png`).
 * - 빈 문자열(공백만 있는 경우 포함)은 빈 문자열을 돌려준다. 버킷 루트 URL 을 만들지 않는다.
 * - 이미 `http(s)://` 로 시작하는 전체 URL 은 그대로 돌려준다(과거 데이터 방어).
 */
export function getStorageImageUrl(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const objectPath = trimmed.replace(/^\/+/, '');
  if (!objectPath) return '';

  return getSupabaseServerClient().storage.from(STORAGE_IMAGES_BUCKET).getPublicUrl(objectPath).data.publicUrl;
}
