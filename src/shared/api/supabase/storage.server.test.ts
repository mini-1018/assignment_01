import { describe, expect, it } from 'vitest';
import { getStorageImageUrl, STORAGE_IMAGES_BUCKET } from './storage.server';

const PUBLIC_BASE = 'https://test.supabase.co/storage/v1/object/public/images';

describe('getStorageImageUrl', () => {
  it('버킷 이름은 images다', () => {
    expect(STORAGE_IMAGES_BUCKET).toBe('images');
  });

  it('객체 경로를 images 버킷의 공개 URL로 바꾼다', () => {
    expect(getStorageImageUrl('products/hidden-kice-pass.png')).toBe(
      `${PUBLIC_BASE}/products/hidden-kice-pass.png`,
    );
  });

  it('앞에 붙은 / 는 하나든 여러 개든 제거한다', () => {
    expect(getStorageImageUrl('/products/a.png')).toBe(`${PUBLIC_BASE}/products/a.png`);
    expect(getStorageImageUrl('///products/a.png')).toBe(`${PUBLIC_BASE}/products/a.png`);
  });

  it('앞뒤 공백은 무시한다', () => {
    expect(getStorageImageUrl('  products/a.png  ')).toBe(`${PUBLIC_BASE}/products/a.png`);
  });

  it('빈 문자열이면 버킷 루트 URL을 만들지 않고 빈 문자열을 돌려준다', () => {
    expect(getStorageImageUrl('')).toBe('');
  });

  it('공백만 있거나 / 만 있으면 빈 문자열을 돌려준다', () => {
    expect(getStorageImageUrl('   ')).toBe('');
    expect(getStorageImageUrl('/')).toBe('');
  });

  it('이미 http(s) 전체 URL이면 그대로 돌려준다', () => {
    expect(getStorageImageUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
    expect(getStorageImageUrl('http://cdn.example.com/a.png')).toBe('http://cdn.example.com/a.png');
    expect(getStorageImageUrl('HTTPS://CDN.example.com/a.png')).toBe('HTTPS://CDN.example.com/a.png');
  });
});
