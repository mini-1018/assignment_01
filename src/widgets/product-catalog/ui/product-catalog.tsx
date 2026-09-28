'use client';

import { useId, useState } from 'react';
import { ProductCard, ProductCardSkeleton, useProducts } from '@/entities/product';
import { ProductFilterBar, type TypeFilter } from '@/features/filter-products';
import { EmptyState, ErrorState } from '@/shared/ui';
import { useDebouncedValue } from '@/shared/lib';
import {
  EMPTY_DESCRIPTION,
  EMPTY_TITLE,
  OFFLINE_DESCRIPTION,
  OFFLINE_TITLE,
  OFFLINE_WITH_RESULTS,
  resolveCatalogState,
} from '../lib/catalog-status';

const SKELETON_COUNT = 12;
/** 목록 영역의 heading. region 의 접근성 이름이 된다. 보조기기와 테스트가 이 이름으로 목록 영역을 찾는다. */
const PRODUCT_LIST_HEADING = '상품 목록';

/**
 * 목록 영역(그리드·빈 상태·오프라인 안내)의 공통 속성. heading 에 연결된 region 으로 노출하고, 갱신 중이면 aria-busy 를 건다.
 * keepPreviousData 로 이전 조건의 결과(목록이든 빈 상태든)를 보여주는 동안(isStale)만 흐리게 한다.
 * 첫 로딩(스켈레톤)은 aria-busy 만 걸고 흐리게 하지 않는다.
 */
function listRegionProps({
  labelledBy,
  isStale = false,
  isLoading = false,
}: {
  labelledBy: string;
  isStale?: boolean;
  isLoading?: boolean;
}) {
  return {
    role: 'region',
    'aria-labelledby': labelledBy,
    'aria-busy': isStale || isLoading || undefined,
    className: `transition-opacity duration-200 ${isStale ? 'opacity-50' : 'opacity-100'}`,
  };
}

/**
 * 시안의 상품 그리드: 1280px 폭, 4열, 열 간격 93px / 행 간격 36px.
 * 목록 의미를 주려고 ul/li 로 둔다(preflight 가 목록 스타일을 지우므로 모양은 같다).
 * Safari 는 list-style 이 없는 ul 의 목록 의미를 지우므로 role="list" 를 명시한다.
 * 스켈레톤 그리드는 장식이라 목록째 aria-hidden 으로 숨긴다(빈 목록으로 읽히지 않게).
 */
function Grid({ children, hidden = false }: { children: React.ReactNode; hidden?: boolean }) {
  return (
    <ul
      role="list"
      aria-hidden={hidden || undefined}
      className="grid w-full grid-cols-2 gap-x-6 gap-y-9 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-[93px]"
    >
      {children}
    </ul>
  );
}

export function ProductCatalog() {
  const headingId = useId();
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState<TypeFilter>(null);

  // 타이핑마다 요청이 나가지 않도록 검색어만 지연시킨다. 필터 탭은 즉시 반영한다.
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const { data, isPending, isPlaceholderData, fetchStatus, error, errorUpdateCount, dataUpdatedAt, refetch } =
    useProducts({ keyword: debouncedKeyword, type });

  // 다시 시도를 누른 시점의 오류와 결과 표식. 같은 조건에서 그 뒤로 새 결과(성공이면 dataUpdatedAt,
  // 실패면 errorUpdateCount 가 바뀐다)가 오기 전까지를 "다시 시도 중"으로 본다. 결과가 오면 저절로 끝나 따로 지우지 않는다.
  const [retry, setRetry] = useState<{
    keyword: string;
    type: TypeFilter;
    error: unknown;
    errorUpdateCount: number;
    dataUpdatedAt: number;
  } | null>(null);
  const retrying =
    retry !== null &&
    retry.keyword === debouncedKeyword &&
    retry.type === type &&
    retry.errorUpdateCount === errorUpdateCount &&
    retry.dataUpdatedAt === dataUpdatedAt;

  const handleRetry = () => {
    setRetry({ keyword: debouncedKeyword, type, error, errorUpdateCount, dataUpdatedAt });
    // 진행 중인 요청이 있으면 취소·재전송하지 않고 그 요청을 기다린다(빠른 연타 대비. ErrorState 도 재시도 중 클릭을 무시한다).
    void refetch({ cancelRefetch: false });
  };

  const { view, live } = resolveCatalogState({
    isPending,
    isPlaceholderData,
    fetchStatus,
    error,
    retryingError: retrying ? retry.error : null,
    count: data?.length ?? 0,
    keyword: debouncedKeyword,
    type,
  });

  // 이전 결과를 보여 주며 갱신 중일 때(live === null)는 직전 문구를 유지해, 새 결과가 오면 바뀐 문구만 읽힌다.
  // 렌더 중 상태 조정 패턴(이전 값 기억)이다. live 가 바뀔 때만 set 하므로 반복 렌더가 생기지 않는다.
  const [lastLive, setLastLive] = useState(live ?? '');
  if (live !== null && live !== lastLive) setLastLive(live);
  const liveText = live ?? lastLive;

  return (
    <section className="flex w-full justify-center px-2.5 py-[50px]">
      <div className="flex w-full max-w-[1280px] flex-col gap-9">
        <ProductFilterBar keyword={keyword} onKeywordChange={setKeyword} type={type} onTypeChange={setType} />

        {/* sr-only 요소는 absolute 라 flex 항목이 아니다. gap 과 배치에 영향을 주지 않는다. */}
        <h2 id={headingId} className="sr-only">
          {PRODUCT_LIST_HEADING}
        </h2>
        {/* 늘 렌더링되는 유일한 live 영역. 로딩·결과·빈 상태·오류·재시도·오프라인 문구를 모두 여기서 알린다. */}
        <p role="status" className="sr-only">
          {liveText}
        </p>

        {view.kind === 'loading' ? (
          <div {...listRegionProps({ labelledBy: headingId, isLoading: true })}>
            <Grid hidden>
              {Array.from({ length: SKELETON_COUNT }, (_, index) => (
                <li key={index}>
                  <ProductCardSkeleton />
                </li>
              ))}
            </Grid>
          </div>
        ) : view.kind === 'offline' ? (
          <div {...listRegionProps({ labelledBy: headingId })}>
            <EmptyState title={OFFLINE_TITLE} description={OFFLINE_DESCRIPTION} />
          </div>
        ) : view.kind === 'error' ? (
          <ErrorState
            message={view.title}
            detail={view.detail}
            retrying={view.retrying}
            onRetry={handleRetry}
          />
        ) : (
          <>
            {/* 오프라인이면 흐림(갱신 중) 대신 안내를 얹는다. 요청이 멈춰 있어 "갱신 중" 표시가 끝나지 않기 때문이다. */}
            {view.offline ? (
              <p className="rounded-sm border border-gray-50 px-4 py-3 text-center text-sm font-medium text-gray-800">
                {OFFLINE_WITH_RESULTS}
              </p>
            ) : null}
            <div {...listRegionProps({ labelledBy: headingId, isStale: view.stale })}>
              {view.count === 0 || !data ? (
                <EmptyState title={EMPTY_TITLE} description={EMPTY_DESCRIPTION} />
              ) : (
                <Grid>
                  {data.map((product) => (
                    <li key={product.id}>
                      <ProductCard product={product} />
                    </li>
                  ))}
                </Grid>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
