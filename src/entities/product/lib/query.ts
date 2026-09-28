/**
 * 상품 조회 도우미. 슬라이스 내부 전용이다(공개 API 에 넣지 않는다). 서버 조회(get-products.server.ts)가 쓴다.
 */

/**
 * 검색어를 LIKE 패턴 안에서 글자 그대로 쓰이도록 이스케이프한다.
 * - `%`, `_` 는 LIKE 와일드카드, `\` 는 PostgreSQL LIKE 의 기본 이스케이프 문자다.
 * - `*` 는 PostgREST 가 like/ilike 값에서 `%` 로 바꾸므로 함께 막는다.
 * PostgREST 는 ilike 값의 백슬래시를 그대로 PostgreSQL 에 넘긴다(원격 DB 실측).
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_*]/g, (char) => `\\${char}`);
}
