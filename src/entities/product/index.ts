export { useProducts } from './api/use-products';
// 구현은 shared/api/http. 위젯(catalog-status)의 import 경로를 바꾸지 않도록 여기서 재수출한다.
export { isNetworkError } from '@/shared/api/http';
export { ProductCard } from './ui/product-card';
export { ProductCardSkeleton } from './ui/product-card-skeleton';
export { hasDiscount, formatPrice } from './model/types';
export { PRODUCT_KEYWORD_MAX_LENGTH } from './model/products-api';
export type { Product, ProductQuery, ProductType } from './model/types';
export type { ProductsResponse } from './model/products-api';
