import Image from 'next/image';
import { getStorageImageUrl } from '@/shared/api/supabase/index.server';

const BANNER_SRC = getStorageImageUrl('banners/promo-banner-1.png');

/**
 * 배너의 문구는 이미지에 그려져 있고 HTML 텍스트로는 없다(시안 1:188 에 텍스트 노드 없음).
 * 그래서 이미지가 유일한 정보 전달 수단이라 장식(alt="")이 아니라 이미지 속 핵심 문구를 alt 로 둔다.
 * 이미지 속 '히든카이스 시리즈 보기' 버튼은 실제로 동작하지 않으므로 alt 에 넣지 않는다.
 */
const BANNER_ALT = '히든카이스 - 모두가 푸는 건 이유가 있습니다. 상위권이 선택한 문제집, 결과로 증명된 실전 대비서';

/**
 * 시안의 프로모션 배너는 단일 이미지 슬라이드다(1/5 인디케이터 포함).
 * 슬라이드 동작에 대한 주석이 없어 시안에 보이는 1번 슬라이드를 그대로 렌더링한다.
 */
export function PromoBanner({ current = 1, total = 5 }: { current?: number; total?: number }) {
  return (
    <section className="relative w-full border-b border-[#e5e5e5] bg-[#fafafa]">
      <div className="relative h-[490px] w-full overflow-hidden bg-[#f2f5f8]">
        <Image
          src={BANNER_SRC}
          alt={BANNER_ALT}
          fill
          // 첫 화면 최상단의 LCP 이미지라 <head>에 preload를 넣는다(Next 16에서 priority는 deprecated → preload).
          preload
          // 배너는 뷰포트 전체 폭을 차지하므로 100vw가 실제 표시 폭과 일치한다.
          sizes="100vw"
          className="object-cover"
        />
        <span className="absolute right-10 bottom-[35px] flex w-[60px] items-center justify-center rounded-full bg-black/30 px-2.5 py-1 text-sm text-white">
          <span className="font-semibold">{current}</span>
          <span className="font-medium">/{total}</span>
        </span>
      </div>
    </section>
  );
}
