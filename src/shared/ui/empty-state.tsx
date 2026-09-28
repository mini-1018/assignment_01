/**
 * 결과가 없거나 보여 줄 내용이 없을 때의 시각 안내.
 * live 역할(role="status")을 두지 않는다. 내용과 함께 새로 삽입된 live 영역은 보조기기가 자주 놓치므로,
 * 알림은 사용하는 쪽이 늘 렌더링해 두는 live 영역 하나가 맡는다.
 */
export function EmptyState({
  title = '표시할 상품이 없습니다',
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-2 rounded-sm border border-gray-50 px-6 py-20 text-center">
      <p className="text-md font-semibold text-gray-800">{title}</p>
      {description ? <p className="text-sm font-medium text-gray-300">{description}</p> : null}
    </div>
  );
}
