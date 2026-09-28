import { describe, expect, it } from 'vitest';
import { describeConditions, resolveCatalogState, type CatalogQueryState } from './catalog-status';

import { ApiError, NetworkError } from '@/shared/api/http';

/** fetch 가 reject 됐을 때 useProducts 가 던지는 오류 */
const networkError = new NetworkError({ cause: new TypeError('Failed to fetch') });
/** BFF 가 Supabase 오류를 502 로 바꿔 돌려준 오류 */
const serverError = new ApiError({ status: 502, code: 'UPSTREAM_ERROR', message: '상품 정보를 불러오지 못했습니다.' });

const settled: CatalogQueryState = {
  isPending: false,
  isPlaceholderData: false,
  fetchStatus: 'idle',
  error: null,
  count: 12,
  keyword: '',
  type: null,
};

describe('describeConditions', () => {
  it('조건이 없으면 "전체", 유형과 검색어는 " · "로 잇는다', () => {
    expect(describeConditions({ keyword: '', type: null })).toBe('전체');
    expect(describeConditions({ keyword: '   ', type: null })).toBe('전체');
    expect(describeConditions({ keyword: '', type: '패스' })).toBe('패스');
    expect(describeConditions({ keyword: ' 국어 ', type: null })).toBe("'국어' 검색");
    expect(describeConditions({ keyword: '국어', type: '단품' })).toBe("단품 · '국어' 검색");
  });

  it('20자를 넘는 검색어는 잘라 말줄임표를 붙인다', () => {
    expect(describeConditions({ keyword: '가'.repeat(21), type: null })).toBe(`'${'가'.repeat(20)}…' 검색`);
    expect(describeConditions({ keyword: '가'.repeat(20), type: null })).toBe(`'${'가'.repeat(20)}' 검색`);
  });
});

describe('resolveCatalogState', () => {
  it('결과는 조건을 담아 알리고, 0개면 "조건에 맞는 상품 없음"이다', () => {
    expect(resolveCatalogState(settled).live).toBe('전체 · 상품 12개');
    expect(resolveCatalogState({ ...settled, type: '패스', keyword: '국어', count: 1 }).live).toBe(
      "패스 · '국어' 검색 · 상품 1개",
    );
    expect(resolveCatalogState({ ...settled, type: '패스', count: 0 })).toEqual({
      view: { kind: 'result', count: 0, stale: false, offline: false },
      live: '패스 · 조건에 맞는 상품 없음',
    });
  });

  it('이전 결과를 보여 주며 갱신 중이면 흐리게 하고 문구는 유지한다(null)', () => {
    expect(resolveCatalogState({ ...settled, isPlaceholderData: true, fetchStatus: 'fetching' })).toEqual({
      view: { kind: 'result', count: 12, stale: true, offline: false },
      live: null,
    });
  });

  it('첫 로딩은 로딩 문구, 데이터 없이 멈추면 오프라인 안내다', () => {
    const pending = { ...settled, isPending: true, count: 0 };
    expect(resolveCatalogState({ ...pending, fetchStatus: 'fetching' })).toEqual({
      view: { kind: 'loading' },
      live: '상품을 불러오는 중입니다',
    });
    expect(resolveCatalogState({ ...pending, fetchStatus: 'paused' })).toEqual({
      view: { kind: 'offline' },
      live: '인터넷에 연결되어 있지 않습니다. 연결되면 자동으로 다시 불러옵니다.',
    });
  });

  it('결과를 보여 주는 중에 멈추면 흐림 대신 오프라인 안내를 얹는다', () => {
    expect(resolveCatalogState({ ...settled, isPlaceholderData: true, fetchStatus: 'paused' })).toEqual({
      view: { kind: 'result', count: 12, stale: false, offline: true },
      live: '인터넷에 연결되어 있지 않아 이전 결과를 보여 줍니다. 연결되면 자동으로 다시 불러옵니다.',
    });
  });

  it('서버 오류는 원인 문구를, 연결 실패는 사용자 안내를 보여 준다', () => {
    expect(resolveCatalogState({ ...settled, error: serverError, count: 0 })).toEqual({
      view: {
        kind: 'error',
        title: '상품을 불러오지 못했습니다.',
        detail: '상품 정보를 불러오지 못했습니다. (UPSTREAM_ERROR)',
        retrying: false,
      },
      live: '상품을 불러오지 못했습니다. 다시 시도해 주세요.',
    });
    expect(resolveCatalogState({ ...settled, error: networkError, count: 0 })).toEqual({
      view: {
        kind: 'error',
        title: '서버에 연결하지 못했습니다.',
        detail: '인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
        retrying: false,
      },
      live: '서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
    });
  });

  it('다시 시도 중이면 쿼리가 pending 으로 돌아가도 누른 오류 화면을 유지하고 진행 중을 알린다', () => {
    const state = resolveCatalogState({
      ...settled,
      isPending: true,
      fetchStatus: 'fetching',
      count: 0,
      retryingError: serverError,
    });
    expect(state.view).toMatchObject({ kind: 'error', title: '상품을 불러오지 못했습니다.', retrying: true });
    expect(state.live).toBe('다시 불러오는 중입니다');
  });

  it('다시 시도 중에 오프라인이 되면 오프라인 안내로 바꾼다', () => {
    expect(
      resolveCatalogState({ ...settled, isPending: true, fetchStatus: 'paused', count: 0, retryingError: networkError })
        .view,
    ).toEqual({ kind: 'offline' });
  });
});
