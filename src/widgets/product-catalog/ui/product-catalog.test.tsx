import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { onlineManager } from '@tanstack/react-query';
import { productFixtures } from '@/test/fixtures/products';
import {
  getLastProductsRequest,
  getProductsRequests,
  productsDelayHandler,
  productsErrorHandler,
  productsHeldHandler,
  productsNetworkErrorHandler,
  productsRowsHandler,
} from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderWithQuery } from '@/test/render';
import { ProductCatalog } from './product-catalog';

const PUBLIC_IMAGE_BASE = 'https://test.supabase.co/storage/v1/object/public/images/';
const ALL_TITLES = [...productFixtures].sort((a, b) => a.sort_order - b.sort_order).map((p) => p.title);
const LIST_NAME = '상품 목록';

/**
 * next/image 는 jsdom 에서도 경고 없이 렌더링되지만 src 를 로더 URL(/_next/image?url=...&w=...)로 바꾼다.
 * 모킹하지 않고 실제 컴포넌트를 쓰되, 원본 주소는 로더 URL 의 url 파라미터로 확인한다.
 */
function originalImageSrc(img: HTMLElement): string | null {
  const src = img.getAttribute('src') ?? '';
  return new URL(src, 'http://localhost').searchParams.get('url');
}

const listRegion = () => screen.getByRole('region', { name: LIST_NAME });
const card = (title: string) => screen.getByRole('article', { name: title });
const cardTitles = () =>
  screen.queryAllByRole('article').map((article) => within(article).getByRole('heading', { level: 3 }).textContent);
const titleRequests = () => getProductsRequests().filter((url) => url.searchParams.has('title'));

/**
 * 화면의 유일한 live 영역. 로딩·결과·빈 상태·오류·재시도·오프라인 문구를 모두 이 한 곳이 알린다.
 * 다른 live 역할(status·alert)이 새로 생기지 않았는지도 함께 확인한다.
 */
function liveStatus() {
  const statuses = screen.getAllByRole('status');
  expect(statuses).toHaveLength(1);
  expect(screen.queryAllByRole('alert')).toHaveLength(0);
  return statuses[0];
}

/** 가짜 시간을 진행시키지 않고 대기 중인 마이크로태스크·0ms 타이머만 비운다(요청이 MSW 에 기록될 때까지). */
async function flushWithoutAdvancing() {
  for (let i = 0; i < 10; i += 1) {
    await act(() => vi.advanceTimersByTimeAsync(0));
  }
}

async function renderCatalog() {
  const utils = renderWithQuery(<ProductCatalog />);
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(12));
  return utils;
}

describe('ProductCatalog', () => {
  afterEach(() => {
    vi.useRealTimers();
    // 오프라인 테스트가 실패해도 다음 테스트가 온라인에서 시작하게 원복한다(onlineManager 는 모듈 단일 인스턴스).
    onlineManager.setOnline(true);
  });

  it('응답이 오기 전에는 로딩 안내와 스켈레톤 12개만 보이고 상품 카드는 없다', async () => {
    server.use(productsDelayHandler('infinite'));
    renderWithQuery(<ProductCatalog />);

    await waitFor(() => expect(liveStatus()).toHaveTextContent(/^상품을 불러오는 중입니다$/));
    const region = listRegion();
    expect(region).toHaveAttribute('aria-busy', 'true');
    // 스켈레톤은 장식이라 목록째 보조기기에서 숨긴다. 숨긴 요소까지 포함해 자리 12개를 세고,
    // 보조기기에는 목록도 항목도 노출되지 않는지 함께 본다.
    expect(within(region).getAllByRole('listitem', { hidden: true })).toHaveLength(12);
    expect(within(region).queryByRole('list')).not.toBeInTheDocument();
    expect(within(region).queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.queryAllByRole('article', { hidden: true })).toHaveLength(0);
    expect(within(region).queryAllByRole('presentation', { hidden: true })).toHaveLength(0);
  });

  it('상품 12개를 sort_order 순서로 보여주고, 개수를 알린다', async () => {
    await renderCatalog();

    expect(cardTitles()).toEqual(ALL_TITLES);
    expect(within(listRegion()).getAllByRole('listitem')).toHaveLength(12);
    expect(listRegion()).not.toHaveAttribute('aria-busy');
    expect(liveStatus()).toHaveTextContent(/^전체 · 상품 12개$/);
  });

  it('목록 영역은 "상품 목록" h2 로 이름이 붙고, 카드 상품명은 그 아래 h3 다', async () => {
    await renderCatalog();

    const heading = screen.getByRole('heading', { level: 2, name: LIST_NAME });
    expect(listRegion()).toHaveAttribute('aria-labelledby', heading.id);
    expect(within(listRegion()).getAllByRole('heading', { level: 3 })).toHaveLength(12);
  });

  it('할인 상품은 정가·할인율·할인가를 구분해 알리고, 단품은 가격만 보여준다', async () => {
    await renderCatalog();

    const pass = within(card('2026 Hidden Kice 국어 패스'));
    expect(pass.getByText('패스')).toBeInTheDocument();
    expect(pass.getByRole('deletion')).toHaveTextContent(/^76,000원$/);
    expect(pass.getByRole('insertion')).toHaveTextContent(/^64,800원$/);
    expect(pass.getByText('5%')).toBeInTheDocument();
    // 보조기기에는 값 앞에 뜻이 붙어 읽힌다.
    expect(pass.getByText('정가')).toBeInTheDocument();
    expect(pass.getByText('할인율')).toBeInTheDocument();
    expect(pass.getByText('할인가')).toBeInTheDocument();

    const single = within(card('2026 Hidden Kice 시즌7'));
    expect(single.getByText('단품')).toBeInTheDocument();
    expect(single.getByText('가격')).toBeInTheDocument();
    expect(single.getByText('40,000원')).toBeInTheDocument();
    expect(single.queryByRole('deletion')).not.toBeInTheDocument();
    expect(single.queryByRole('insertion')).not.toBeInTheDocument();
    expect(single.queryByText('정가')).not.toBeInTheDocument();
    expect(single.queryByText(/%$/)).not.toBeInTheDocument();
  });

  it('카드 이미지는 장식(alt="")이고 Storage 공개 URL 을 쓴다', async () => {
    await renderCatalog();

    expect(originalImageSrc(within(card('2026 Hidden Kice 시즌7')).getByRole('presentation'))).toBe(
      `${PUBLIC_IMAGE_BASE}products/hidden-kice-single.png`,
    );
    expect(originalImageSrc(within(card('2026 Hidden Kice 시즌7 올패스')).getByRole('presentation'))).toBe(
      `${PUBLIC_IMAGE_BASE}products/hidden-kice-pass.png`,
    );
    // 이미지가 상품명을 되풀이하지 않는다(이름 있는 img 가 없다).
    expect(within(listRegion()).queryAllByRole('img')).toHaveLength(0);
    // 12장 모두 같은 공개 버킷 경로를 쓴다.
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(12);
    for (const article of cards) {
      const image = within(article).getByRole('presentation');
      expect(image).toHaveAttribute('alt', '');
      expect(originalImageSrc(image)?.startsWith(`${PUBLIC_IMAGE_BASE}products/`)).toBe(true);
    }
  });

  it('유형 탭으로 패스·단품만 보고, 전체로 돌아갈 수 있다', async () => {
    const { user } = await renderCatalog();
    const allTab = screen.getByRole('button', { name: '전체' });
    const passTab = screen.getByRole('button', { name: '패스' });
    const singleTab = screen.getByRole('button', { name: '단품' });
    expect(allTab).toHaveAttribute('aria-pressed', 'true');

    await user.click(passTab);
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(9));
    expect(getLastProductsRequest().searchParams.get('product_type')).toBe('eq.패스');
    expect(passTab).toHaveAttribute('aria-pressed', 'true');
    expect(allTab).toHaveAttribute('aria-pressed', 'false');
    expect(liveStatus()).toHaveTextContent(/^패스 · 상품 9개$/);

    await user.click(singleTab);
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));
    expect(getLastProductsRequest().searchParams.get('product_type')).toBe('eq.단품');
    expect(cardTitles()).toEqual(['2026 Hidden Kice 시즌7', '2026 Hidden Kice 시즌6', '2026 Hidden Kice 시즌5']);

    await user.click(allTab);
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(12));
    expect(cardTitles()).toEqual(ALL_TITLES);
    expect(allTab).toHaveAttribute('aria-pressed', 'true');
  });

  it('검색어는 입력이 멈추고 정확히 300ms 가 지난 직후 한 번만 요청되고(299ms 에는 없다), 지우면 전체로 돌아온다', async () => {
    const { user } = await renderCatalog();
    // 첫 목록은 실제 타이머로 받는다. 경계를 정확히 보려고 자동 진행 없는 가짜 타이머로 바꾼다.
    // 가짜 타이머 구간에서는 waitFor·user-event 를 쓰지 않는다. RTL 비동기 도우미는 가짜 시간을 스스로 진행시킬 수 있어
    // (jest 전역이 있을 때) 긴 지연도 결국 통과시키고, 없으면 0ms 대기가 끝나지 않는다. 입력은 동기 fireEvent 로 넣고
    // 요청 수는 시간을 더 진행시키지 않은 채 동기적으로 단언한다.
    vi.useFakeTimers();
    const searchBox = screen.getByRole('searchbox', { name: '상품명 검색' });

    fireEvent.change(searchBox, { target: { value: '국' } });
    await act(() => vi.advanceTimersByTimeAsync(200));
    // 입력이 이어지면 대기가 처음부터 다시 시작된다.
    fireEvent.change(searchBox, { target: { value: '국어' } });
    expect(searchBox).toHaveValue('국어');

    await act(() => vi.advanceTimersByTimeAsync(299));
    await flushWithoutAdvancing();
    expect(titleRequests()).toHaveLength(0);
    expect(screen.getAllByRole('article')).toHaveLength(12);

    await act(() => vi.advanceTimersByTimeAsync(1));
    await flushWithoutAdvancing();
    // 300ms 시점에 이미 요청이 나갔어야 한다(상한). 중간 입력 '국'으로는 요청하지 않는다.
    expect(titleRequests()).toHaveLength(1);
    expect(getLastProductsRequest().searchParams.get('title')).toBe('ilike.%국어%');

    // 경계 확인이 끝났으니 실제 타이머로 돌려 응답과 이후 동작을 본다.
    vi.useRealTimers();
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
    expect(cardTitles()).toEqual(['2026 Hidden Kice 국어 패스']);
    expect(titleRequests()).toHaveLength(1);
    expect(liveStatus()).toHaveTextContent(/^'국어' 검색 · 상품 1개$/);

    await user.click(screen.getByRole('button', { name: '검색어 지우기' }));
    expect(searchBox).toHaveValue('');
    expect(screen.queryByRole('button', { name: '검색어 지우기' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(12));
    expect(cardTitles()).toEqual(ALL_TITLES);
    expect(liveStatus()).toHaveTextContent(/^전체 · 상품 12개$/);
  });

  it('패스 탭을 누르고 "국어"를 검색하면 두 조건이 한 요청에 함께 실려 카드 1개가 보인다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderCatalog();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await user.click(screen.getByRole('button', { name: '패스' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(9));
    await user.type(screen.getByRole('searchbox', { name: '상품명 검색' }), '국어');
    await act(() => vi.advanceTimersByTimeAsync(300));

    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
    expect(cardTitles()).toEqual(['2026 Hidden Kice 국어 패스']);
    const combined = getProductsRequests().filter(
      (url) =>
        url.searchParams.get('product_type') === 'eq.패스' && url.searchParams.get('title') === 'ilike.%국어%',
    );
    expect(combined).toHaveLength(1);
    expect(getLastProductsRequest()).toBe(combined[0]);
  });

  it('결과가 없는 검색어에는 빈 상태 안내를 보여주고, 조건을 담은 문구로 live 영역에서 알린다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderCatalog();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await user.type(screen.getByRole('searchbox', { name: '상품명 검색' }), '없는상품');
    await act(() => vi.advanceTimersByTimeAsync(300));

    expect(await screen.findByText('조건에 맞는 상품이 없습니다')).toBeInTheDocument();
    expect(within(listRegion()).getByText('검색어나 필터를 바꿔 보세요.')).toBeInTheDocument();
    // 빈 상태 안내는 시각 표시일 뿐 새 live 영역을 만들지 않는다. 알림은 늘 있는 live 영역 하나가 맡는다.
    expect(liveStatus()).toHaveTextContent(/^'없는상품' 검색 · 조건에 맞는 상품 없음$/);
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(getLastProductsRequest().searchParams.get('title')).toBe('ilike.%없는상품%');
  });

  it('빈 상태에서 조건만 바꿔 다시 빈 상태가 되어도 바뀐 조건으로 다시 알린다', async () => {
    server.use(productsRowsHandler([]));
    const { user } = renderWithQuery(<ProductCatalog />);
    await waitFor(() => expect(liveStatus()).toHaveTextContent(/^전체 · 조건에 맞는 상품 없음$/));

    await user.click(screen.getByRole('button', { name: '패스' }));
    await waitFor(() => expect(liveStatus()).toHaveTextContent(/^패스 · 조건에 맞는 상품 없음$/));
    expect(screen.getByText('조건에 맞는 상품이 없습니다')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '단품' }));
    await waitFor(() => expect(liveStatus()).toHaveTextContent(/^단품 · 조건에 맞는 상품 없음$/));
  });

  it('조회에 실패하면 원인과 함께 오류를 알리고, 다시 시도로 목록을 불러온다', async () => {
    server.use(productsErrorHandler());
    const { user } = renderWithQuery(<ProductCatalog />);

    expect(await screen.findByText('상품을 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByText('Could not connect to database (PGRST000)')).toBeInTheDocument();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(liveStatus()).toHaveTextContent(/^상품을 불러오지 못했습니다\. 다시 시도해 주세요\.$/);

    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(12));
    expect(screen.queryByText('상품을 불러오지 못했습니다.')).not.toBeInTheDocument();
    expect(liveStatus()).toHaveTextContent(/^전체 · 상품 12개$/);
  });

  it('다시 시도를 누르면 응답이 올 때까지 버튼을 비활성화하고 진행 중을 알리며, 거듭 눌러도 요청은 한 번이다', async () => {
    server.use(productsErrorHandler());
    const { user } = renderWithQuery(<ProductCatalog />);
    expect(await screen.findByText('상품을 불러오지 못했습니다.')).toBeInTheDocument();
    const failedRequests = getProductsRequests().length;

    const held = productsHeldHandler();
    server.use(held.handler);
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    const busyButton = await screen.findByRole('button', { name: '다시 불러오는 중…' });
    expect(busyButton).toHaveAttribute('aria-disabled', 'true');
    // 포커스를 잃지 않도록 disabled 대신 aria-disabled 를 쓴다.
    expect(busyButton).toBeEnabled();
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
    expect(liveStatus()).toHaveTextContent(/^다시 불러오는 중입니다$/);
    // 오류 안내는 그대로 두어 무엇을 다시 시도하는지 보인다.
    expect(screen.getByText('상품을 불러오지 못했습니다.')).toBeInTheDocument();

    await user.click(busyButton);
    await user.dblClick(busyButton);

    held.release();
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(12));
    // 재시도 요청은 한 번뿐이다(붙잡힌 동안 보낸 중복 요청도 모두 기록된다).
    expect(getProductsRequests().length - failedRequests).toBe(1);
    expect(screen.queryByRole('button', { name: /다시/ })).not.toBeInTheDocument();
    expect(liveStatus()).toHaveTextContent(/^전체 · 상품 12개$/);
  });

  it('목록을 받은 뒤 다시 조회하다 실패한 경우에도, 다시 시도를 거듭 눌러 진행 중 요청이 취소·재전송되지 않는다', async () => {
    // 데이터가 있는 쿼리는 TanStack 이 진행 중 요청을 취소하고 새로 보낼 수 있는 경로다(데이터 없는 쿼리는 늘 합쳐진다).
    const { user, queryClient } = await renderCatalog();
    server.use(productsErrorHandler());
    await act(() => queryClient.refetchQueries());
    expect(await screen.findByText('상품을 불러오지 못했습니다.')).toBeInTheDocument();
    const failedRequests = getProductsRequests().length;

    const held = productsHeldHandler();
    server.use(held.handler);
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    const busyButton = await screen.findByRole('button', { name: '다시 불러오는 중…' });
    expect(liveStatus()).toHaveTextContent(/^다시 불러오는 중입니다$/);
    await user.click(busyButton);
    await user.dblClick(busyButton);

    held.release();
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(12));
    expect(getProductsRequests().length - failedRequests).toBe(1);
    expect(liveStatus()).toHaveTextContent(/^전체 · 상품 12개$/);
  });

  it('서버에 닿지 못하면 원인 코드 대신 연결을 확인하라는 안내를 보여주고 알린다', async () => {
    server.use(productsNetworkErrorHandler());
    renderWithQuery(<ProductCatalog />);

    expect(await screen.findByText('서버에 연결하지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByText('인터넷 연결을 확인한 뒤 다시 시도해 주세요.')).toBeInTheDocument();
    expect(screen.queryByText(/TypeError|Failed to fetch/)).not.toBeInTheDocument();
    expect(screen.queryByText('상품을 불러오지 못했습니다.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(liveStatus()).toHaveTextContent(
      /^서버에 연결하지 못했습니다\. 인터넷 연결을 확인한 뒤 다시 시도해 주세요\.$/,
    );
    expect(getProductsRequests()).toHaveLength(1);
  });

  it('오프라인이면 스켈레톤 대신 연결 안내를 보여주고, 온라인이 되면 저절로 불러온다', async () => {
    onlineManager.setOnline(false);
    renderWithQuery(<ProductCatalog />);

    await waitFor(() =>
      expect(liveStatus()).toHaveTextContent(
        /^인터넷에 연결되어 있지 않습니다\. 연결되면 자동으로 다시 불러옵니다\.$/,
      ),
    );
    const region = listRegion();
    expect(within(region).getByText('인터넷에 연결되어 있지 않습니다')).toBeInTheDocument();
    expect(within(region).getByText('연결되면 자동으로 다시 불러옵니다.')).toBeInTheDocument();
    expect(within(region).queryAllByRole('listitem', { hidden: true })).toHaveLength(0);
    expect(region).not.toHaveAttribute('aria-busy');
    // 요청은 멈춰 있다(오류로 바뀌지도 않는다).
    expect(getProductsRequests()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();

    act(() => onlineManager.setOnline(true));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(12));
    expect(screen.queryByText('인터넷에 연결되어 있지 않습니다')).not.toBeInTheDocument();
    expect(liveStatus()).toHaveTextContent(/^전체 · 상품 12개$/);
    expect(getProductsRequests()).toHaveLength(1);
  });

  it('결과를 보여 주는 중에 오프라인에서 조건을 바꾸면 이전 결과를 그대로 두고 흐림 대신 연결 안내를 얹는다', async () => {
    const { user } = await renderCatalog();
    act(() => onlineManager.setOnline(false));

    await user.click(screen.getByRole('button', { name: '패스' }));

    const offlineText = '인터넷에 연결되어 있지 않아 이전 결과를 보여 줍니다. 연결되면 자동으로 다시 불러옵니다.';
    await waitFor(() => expect(liveStatus()).toHaveTextContent(offlineText));
    // live 영역과 별도로 화면에 보이는 안내가 하나 있다.
    expect(screen.getAllByText(offlineText).filter((element) => element !== liveStatus())).toHaveLength(1);
    expect(cardTitles()).toEqual(ALL_TITLES);
    // 멈춘 요청을 "갱신 중"으로 표시하지 않는다.
    expect(listRegion()).not.toHaveAttribute('aria-busy');
    expect(getProductsRequests().filter((url) => url.searchParams.has('product_type'))).toHaveLength(0);

    act(() => onlineManager.setOnline(true));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(9));
    expect(getLastProductsRequest().searchParams.get('product_type')).toBe('eq.패스');
    expect(screen.queryByText(/인터넷에 연결되어 있지 않아/)).not.toBeInTheDocument();
    expect(liveStatus()).toHaveTextContent(/^패스 · 상품 9개$/);
  });

  it('이전 결과를 보여 주는 중에 조건을 바꿨다가 실패하면 이전 카드를 지우고 오류와 다시 시도를 보여준다', async () => {
    const { user } = await renderCatalog();
    server.use(productsErrorHandler());

    await user.click(screen.getByRole('button', { name: '패스' }));

    expect(await screen.findByText('상품을 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.queryByRole('region', { name: LIST_NAME })).not.toBeInTheDocument();
    // 갱신 중 표시가 남지 않는다.
    expect(document.querySelector('[aria-busy]')).toBeNull();
    expect(liveStatus()).toHaveTextContent(/^상품을 불러오지 못했습니다\. 다시 시도해 주세요\.$/);
    expect(getLastProductsRequest().searchParams.get('product_type')).toBe('eq.패스');

    // 다시 시도는 바뀐 조건(패스)으로 요청한다.
    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(9));
    expect(getLastProductsRequest().searchParams.get('product_type')).toBe('eq.패스');
    expect(screen.queryByText('상품을 불러오지 못했습니다.')).not.toBeInTheDocument();
    expect(listRegion()).not.toHaveAttribute('aria-busy');
    expect(liveStatus()).toHaveTextContent(/^패스 · 상품 9개$/);
  });

  it('조건을 바꾸면 새 응답이 올 때까지 이전 카드를 그대로 두고 목록을 갱신 중으로 표시한다', async () => {
    const { user } = await renderCatalog();
    const held = productsHeldHandler();
    server.use(held.handler);

    await user.click(screen.getByRole('button', { name: '패스' }));

    await waitFor(() => expect(listRegion()).toHaveAttribute('aria-busy', 'true'));
    expect(getLastProductsRequest().searchParams.get('product_type')).toBe('eq.패스');
    expect(cardTitles()).toEqual(ALL_TITLES);
    // 이전 결과가 보이는 동안에는 로딩 문구로 바꾸지 않고 이전 개수를 유지한다.
    expect(liveStatus()).toHaveTextContent(/^전체 · 상품 12개$/);

    held.release();
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(9));
    expect(listRegion()).not.toHaveAttribute('aria-busy');
    expect(liveStatus()).toHaveTextContent(/^패스 · 상품 9개$/);
  });

  it('빈 상태에서 조건을 바꾸면 새 응답이 올 때까지 빈 안내를 두고 갱신 중으로 표시한다', async () => {
    server.use(productsRowsHandler([]));
    const { user } = renderWithQuery(<ProductCatalog />);
    expect(await screen.findByText('조건에 맞는 상품이 없습니다')).toBeInTheDocument();
    expect(listRegion()).not.toHaveAttribute('aria-busy');

    const held = productsHeldHandler();
    server.use(held.handler);
    await user.click(screen.getByRole('button', { name: '패스' }));

    await waitFor(() => expect(listRegion()).toHaveAttribute('aria-busy', 'true'));
    expect(within(listRegion()).getByText('조건에 맞는 상품이 없습니다')).toBeInTheDocument();
    // 이전 조건의 문구를 유지한다(새 결과가 오면 바뀐 문구만 읽힌다).
    expect(liveStatus()).toHaveTextContent(/^전체 · 조건에 맞는 상품 없음$/);
    expect(getLastProductsRequest().searchParams.get('product_type')).toBe('eq.패스');

    held.release();
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(9));
    expect(listRegion()).not.toHaveAttribute('aria-busy');
    expect(screen.queryByText('조건에 맞는 상품이 없습니다')).not.toBeInTheDocument();
    expect(liveStatus()).toHaveTextContent(/^패스 · 상품 9개$/);
  });
});
