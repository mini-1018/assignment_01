import type { ProductType } from '@/entities/product';

/** 시안의 필터 탭: 전체 | 패스 | 단품. null 은 '전체' */
export type TypeFilter = ProductType | null;

export const TYPE_FILTERS: ReadonlyArray<{ label: string; value: TypeFilter }> = [
  { label: '전체', value: null },
  { label: '패스', value: '패스' },
  { label: '단품', value: '단품' },
];
