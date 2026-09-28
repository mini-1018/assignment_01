-- 콘텐츠 이미지(상품, 배너) 저장소
-- 이미지를 public/ 에 두면 상품을 추가할 때마다 재배포해야 한다.
-- 데이터(products.image_url)와 이미지를 같은 곳(Supabase)에서 관리한다.
--
-- public 버킷: 공개 URL(/storage/v1/object/public/images/...)로 누구나 읽는다.
-- storage.objects 에 anon 정책을 두지 않으므로 목록 조회와 업로드·삭제는 막힌다.
-- 업로드는 secret 키(서버·로컬 스크립트)로만 한다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
