import { useId } from "react";
import Image from "next/image";
import { formatPrice, hasDiscount, type Product } from "../model/types";

/**
 * 시안의 상품 카드. 이미지 250x320, 하단에 유형/상품명/가격.
 * 상세 화면이 없으므로 카드는 이동하지 않는 표시 전용 요소다.
 *
 * 접근성
 * - 상품명은 h3 다. 페이지 구조(h1 스토어 → 목록 영역 → 카드)에서 카드가 세 번째 단계이기 때문이다.
 *   Tailwind preflight 가 heading 의 크기·굵기·여백을 초기화하므로 모양은 이전 `<p>` 와 같다.
 * - article 은 상품명(heading)을 접근성 이름으로 쓴다(aria-labelledby).
 * - 이미지는 상품명을 되풀이할 뿐이라 장식(alt="")으로 둔다. 상품명이 두 번 읽히지 않는다.
 * - 가격은 sr-only 문구("정가", "할인율", "할인가", "가격")로 뜻을 붙이고, 정가·할인가는 `<del>`/`<ins>` 로 둔다.
 *   취소선만으로는 보조기기에 "어느 쪽이 결제 가격인지"가 전달되지 않는다(WCAG 1.3.1).
 *   sr-only 문구는 값 요소 밖의 형제로 둬서 값 요소의 글자는 가격 그대로다.
 */
export function ProductCard({ product }: { product: Product }) {
  const titleId = useId();

  return (
    <article className="w-full" aria-labelledby={titleId}>
      <div className="flex w-full flex-col gap-1">
        <div className="relative aspect-[250/320] w-full overflow-hidden rounded-sm border border-gray-50 bg-white">
          <Image
            src={product.image_url}
            alt=""
            fill
            sizes="(max-width: 768px) 50vw, 250px"
            className="object-contain"
          />
        </div>

        <div className="flex flex-col">
          <p className="text-md font-semibold text-gray-300">
            {product.product_type}
          </p>
          <div className="flex flex-col gap-2">
            <h3 id={titleId} className="text-md font-semibold text-black">
              {product.title}
            </h3>

            {hasDiscount(product) ? (
              <div className="flex flex-col">
                <p className="text-sm font-medium text-gray-200">
                  <span className="sr-only">정가 </span>
                  <del className="line-through">
                    {formatPrice(product.price)}
                  </del>
                </p>
                <p className="flex items-center gap-1.5 text-md font-semibold whitespace-nowrap">
                  {/* sr-only 는 absolute 라 flex 항목이 아니다. gap 과 배치에 영향을 주지 않는다. */}
                  <span className="sr-only">할인율 </span>
                  <span className="text-secondary">
                    {product.discount_rate}%
                  </span>
                  <span className="sr-only">할인가 </span>
                  <ins className="text-black no-underline">
                    {formatPrice(product.sale_price as number)}
                  </ins>
                </p>
              </div>
            ) : (
              <p className="text-md font-semibold text-black">
                <span className="sr-only">가격 </span>
                <span>{formatPrice(product.price)}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
