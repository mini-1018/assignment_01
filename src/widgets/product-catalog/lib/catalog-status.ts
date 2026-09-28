import { isNetworkError } from '@/entities/product';
import type { TypeFilter } from '@/features/filter-products';

/**
 * 상품 목록 영역의 상태 판정과 live 영역 문구.
 *
 * 화면의 상태 문구는 늘 렌더링되는 live 영역 하나(`role="status"`)가 전부 맡는다.
 * EmptyState·ErrorState·오프라인 안내는 시각 표시만 하고 live 역할을 갖지 않는다.
 * 새로 삽입된 live 영역은 보조기기가 자주 놓치고, 같은 상태가 반복되면 DOM 변화가 없어 아무것도 읽히지 않기 때문이다.
 */

export const LIVE_LOADING = '상품을 불러오는 중입니다';
export const LIVE_RETRYING = '다시 불러오는 중입니다';
export const OFFLINE_TITLE = '인터넷에 연결되어 있지 않습니다';
export const OFFLINE_DESCRIPTION = '연결되면 자동으로 다시 불러옵니다.';
export const OFFLINE_WITH_RESULTS = '인터넷에 연결되어 있지 않아 이전 결과를 보여 줍니다. 연결되면 자동으로 다시 불러옵니다.';
export const ERROR_TITLE = '상품을 불러오지 못했습니다.';
export const NETWORK_ERROR_TITLE = '서버에 연결하지 못했습니다.';
export const NETWORK_ERROR_DETAIL = '인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
export const EMPTY_TITLE = '조건에 맞는 상품이 없습니다';
export const EMPTY_DESCRIPTION = '검색어나 필터를 바꿔 보세요.';

/** live 문구에 넣는 검색어 최대 길이. 긴 검색어가 문구를 장황하게 만들지 않게 자른다. */
const KEYWORD_MAX = 20;

export type CatalogView =
  | { kind: 'loading' }
  /** 데이터 없이 오프라인이라 요청이 멈춘 상태(TanStack fetchStatus 'paused') */
  | { kind: 'offline' }
  | { kind: 'error'; title: string; detail?: string; retrying: boolean }
  /**
   * 결과(목록 또는 빈 상태). stale: 이전 조건의 결과를 보여 주며 새 응답을 기다리는 중.
   * offline: 결과를 보여 주는 중에 오프라인이라 새 요청이 멈췄다(흐리게 하지 않고 안내를 얹는다).
   */
  | { kind: 'result'; count: number; stale: boolean; offline: boolean };

export type CatalogState = {
  view: CatalogView;
  /** live 영역 문구. null 이면 직전 문구를 유지한다(이전 결과를 보여 주며 갱신 중일 때). */
  live: string | null;
};

export type CatalogQueryState = {
  isPending: boolean;
  isPlaceholderData: boolean;
  fetchStatus: 'fetching' | 'paused' | 'idle';
  error: unknown;
  /**
   * 다시 시도 중인 오류. 다시 시도를 누른 뒤 새 결과(성공·실패)가 오기 전까지 값이 있다.
   * 데이터가 없는 쿼리를 다시 조회하면 TanStack 이 status 를 'pending' 으로 되돌리고 error 를 비우므로(query-core fetchState),
   * 누른 오류를 따로 기억해야 오류 화면을 유지한 채 진행 중을 보여 줄 수 있다.
   */
  retryingError?: unknown;
  count: number;
  /** 요청에 실린(디바운스된) 검색어 */
  keyword: string;
  type: TypeFilter;
};

/**
 * 조건 요약. 같은 문구가 연달아 나와도(빈 → 빈, 9개 → 9개) 조건이 바뀌었으면 문구가 달라져 다시 읽히게 한다.
 * 예: "전체", "패스", "'국어' 검색", "패스 · '국어' 검색"
 */
export function describeConditions({ keyword, type }: { keyword: string; type: TypeFilter }): string {
  const trimmed = keyword.trim();
  const shown = trimmed.length > KEYWORD_MAX ? `${trimmed.slice(0, KEYWORD_MAX)}…` : trimmed;
  const parts = [type, shown ? `'${shown}' 검색` : null].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '전체';
}

export function resultMessage(conditions: string, count: number): string {
  return count > 0 ? `${conditions} · 상품 ${count}개` : `${conditions} · 조건에 맞는 상품 없음`;
}

export function resolveCatalogState(query: CatalogQueryState): CatalogState {
  const { isPending, isPlaceholderData, fetchStatus, count } = query;
  const retrying = query.retryingError != null;
  const error = retrying ? query.retryingError : query.error;
  const paused = fetchStatus === 'paused';

  // 보여 줄 결과가 없는데 요청이 멈췄으면 스켈레톤·오류 대신 오프라인 안내. 온라인이 되면 TanStack 이 자동 재개한다.
  if (paused && (isPending || error)) {
    return { view: { kind: 'offline' }, live: `${OFFLINE_TITLE}. ${OFFLINE_DESCRIPTION}` };
  }

  if (error) {
    const network = isNetworkError(error);
    const title = network ? NETWORK_ERROR_TITLE : ERROR_TITLE;
    const detail = network ? NETWORK_ERROR_DETAIL : error instanceof Error ? error.message : undefined;
    const live = retrying ? LIVE_RETRYING : network ? `${title} ${detail}` : `${title} 다시 시도해 주세요.`;
    return { view: { kind: 'error', title, detail, retrying }, live };
  }

  if (isPending) return { view: { kind: 'loading' }, live: LIVE_LOADING };

  if (paused) {
    return { view: { kind: 'result', count, stale: false, offline: true }, live: OFFLINE_WITH_RESULTS };
  }
  if (isPlaceholderData) {
    return { view: { kind: 'result', count, stale: true, offline: false }, live: null };
  }
  return {
    view: { kind: 'result', count, stale: false, offline: false },
    live: resultMessage(describeConditions(query), count),
  };
}
