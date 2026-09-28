import type { ProductRow, ProductType } from '@/shared/api/supabase';

/**
 * 화면에서 쓰는 상품 타입. Supabase Row 의 필드명을 그대로 쓴다(필드명 변환 금지).
 * 단, `image_url` 은 값의 의미만 다르다. DB 행은 Storage 객체 경로를 담고,
 * 훅(useProducts)이 이를 공개 URL 로 바꿔 돌려준다.
 */
export type Product = Omit<ProductRow, 'image_url'> & {
  /** 화면에 바로 쓸 수 있는 이미지 URL(Storage 공개 URL). 객체 경로가 아니다. */
  image_url: string;
};
export type { ProductType };

/** 상품 목록 조회 조건 */
export type ProductQuery = {
  /** 상품명 검색어. 빈 문자열이면 전체 */
  keyword: string;
  /** 유형 필터. null 이면 전체 */
  type: ProductType | null;
};

/** 할인 중인 상품인지 판정한다. 카드 표시 분기의 단일 기준이다. */
export function hasDiscount(product: Product): boolean {
  return product.sale_price !== null && product.discount_rate !== null;
}

/** 1000 단위 구분 기호가 붙은 원화 표기 */
export function formatPrice(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}
