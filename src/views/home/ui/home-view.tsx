import { PromoBanner } from '@/widgets/promo-banner';
import { ProductCatalog } from '@/widgets/product-catalog';

/**
 * 홈(스토어) 화면 조립.
 * 시안에는 보이는 제목이 없어 h1 은 sr-only 로 둔다. 제목 계층은 h1 스토어 → h2 상품 목록(카탈로그) → h3 상품명(카드)이다.
 */
export function HomeView() {
  return (
    <>
      <h1 className="sr-only">스토어</h1>
      <PromoBanner />
      <ProductCatalog />
    </>
  );
}
