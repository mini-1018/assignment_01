// 서버 전용 공개 API. 클라이언트 컴포넌트는 `@/entities/product`(index.ts)만 import 한다.
export { getProducts } from './api/get-products.server';
// 순수 함수지만 쓰는 곳이 BFF(src/app/api-routes)뿐이다. index.ts 로 가져오면 라우트의 모듈 그래프에
// 브라우저 훅·클라이언트 컴포넌트가 딸려 오므로 서버 공개 API 로 내보낸다.
export { parseProductsSearchParams } from './model/products-api';
