'use client';

import { SvgIcon } from '@/shared/ui';
import { TYPE_FILTERS, type TypeFilter } from '../model/types';
import { PRODUCT_KEYWORD_MAX_LENGTH } from '@/entities/product';

type ProductFilterBarProps = {
  keyword: string;
  onKeywordChange: (value: string) => void;
  type: TypeFilter;
  onTypeChange: (value: TypeFilter) => void;
};

/**
 * 시안 주석: "검색 기능 및 필터기능 구현 요망"
 * 검색어와 유형 필터를 모두 상위(카탈로그 위젯)의 상태로 올려 조회 조건으로 쓴다.
 */
export function ProductFilterBar({ keyword, onKeywordChange, type, onTypeChange }: ProductFilterBarProps) {
  return (
    <div className="flex w-full items-center justify-end gap-[17px]">
      <div className="flex w-[250px] items-center gap-2 rounded-sm border border-gray-100 p-2">
        <SvgIcon src="/assets/icons/search.svg" width={20} height={20} />
        <input
          type="search"
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          maxLength={PRODUCT_KEYWORD_MAX_LENGTH}
          placeholder="검색"
          aria-label="상품명 검색"
          className="min-w-0 flex-1 text-md font-semibold text-gray-800 outline-none placeholder:text-gray-300 [&::-webkit-search-cancel-button]:hidden"
        />
        {keyword ? (
          <button type="button" onClick={() => onKeywordChange('')} aria-label="검색어 지우기" className="shrink-0">
            <SvgIcon src="/assets/icons/x.svg" width={16} height={16} />
          </button>
        ) : (
          <span className="block size-4 shrink-0" aria-hidden />
        )}
      </div>

      <div className="flex items-center gap-[11px]">
        {TYPE_FILTERS.map((filter, index) => (
          <span key={filter.label} className="flex items-center gap-[11px]">
            {index > 0 ? <span className="text-md font-semibold text-gray-300" aria-hidden>|</span> : null}
            <button
              type="button"
              onClick={() => onTypeChange(filter.value)}
              aria-pressed={filter.value === type}
              className={`text-md font-semibold ${filter.value === type ? 'text-gray-800' : 'text-gray-300'}`}
            >
              {filter.label}
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
