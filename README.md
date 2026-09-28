# HIDDEN KICE

## 스택

- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind CSS v4
- TanStack Query v5
- Supabase (Postgres · Storage)
- Vitest · Testing Library · MSW
- 구조: Feature-Sliced Design (FSD)

## 폴더 구조

```
app/                    Next.js 라우팅 (layout, page)
src/
  app/                  providers, styles, 공통 셸
  views/                화면 조립 (home)
  widgets/              gnb, promo-banner, product-catalog, footer
  features/             filter-products
  entities/             product
  shared/               api/supabase, config, lib, ui
test/                   테스트 공용 도구 (MSW, fixtures, render)
supabase/               migrations, seed.sql, apply.sql
public/assets/icons/    아이콘 SVG
```

의존은 `app → views → widgets → features → entities → shared` 방향으로만 흐르고, 슬라이스는 `index.ts`로만 참조한다.
