'use client';

/**
 * 오류의 시각 안내와 다시 시도 버튼.
 * live 역할(role="alert")을 두지 않는다. 알림은 사용하는 쪽이 늘 렌더링해 두는 live 영역 하나가 맡는다
 * (같은 오류가 반복되면 alert 요소는 DOM 변화가 없어 다시 읽히지 않는다).
 *
 * retrying 동안 버튼은 `aria-disabled` 로 비활성화하고 문구를 바꾼다. `disabled` 를 쓰지 않는 이유는
 * 키보드로 누른 버튼이 disabled 가 되면 포커스가 문서 처음으로 튕기기 때문이다. 대신 클릭을 무시해 중복 요청을 막는다.
 */
export function ErrorState({
  message = '데이터를 불러오지 못했습니다.',
  detail,
  onRetry,
  retrying = false,
}: {
  message?: string;
  detail?: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div
      aria-busy={retrying || undefined}
      className="flex w-full flex-col items-center gap-3 rounded-sm border border-gray-50 px-6 py-20 text-center"
    >
      <p className="text-md font-semibold text-error">{message}</p>
      {detail ? <p className="max-w-[640px] text-sm font-medium text-gray-300">{detail}</p> : null}
      {onRetry ? (
        <button
          type="button"
          aria-disabled={retrying || undefined}
          onClick={() => {
            if (!retrying) onRetry();
          }}
          className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-white aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
        >
          {retrying ? '다시 불러오는 중…' : '다시 시도'}
        </button>
      ) : null}
    </div>
  );
}
