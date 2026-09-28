/**
 * Supabase 스키마 타입.
 *
 * 수동 작성본이다. supabase/migrations 의 SQL 과 대조해 관리하고,
 * CLI 를 쓸 수 있게 되면 아래 명령으로 반드시 재생성한다.
 *   npx supabase gen types typescript --project-id biemzclytdzypuncjvtx > src/shared/api/supabase/types.ts
 */

/** 시안의 상품 유형 라벨. DB 의 check 제약과 값이 같아야 한다. */
export type ProductType = '단품' | '패스';

export type ProductRow = {
  id: string;
  product_type: ProductType;
  title: string;
  /** 정가(원). 할인이 있으면 취소선으로 표시된다. */
  price: number;
  /** 할인가(원). 할인이 없으면 null */
  sale_price: number | null;
  /** 할인율(%). 할인이 없으면 null */
  discount_rate: number | null;
  /** `images` 버킷 안의 객체 경로(예: `products/hidden-kice-pass.png`). 전체 URL 이 아니다. */
  image_url: string;
  /** 시안의 노출 순서 */
  sort_order: number;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      products: {
        Row: ProductRow;
        Insert: Omit<ProductRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<ProductRow>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
