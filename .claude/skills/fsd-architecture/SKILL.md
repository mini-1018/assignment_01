---
name: fsd-architecture
description: "Next.js App Router 프로젝트를 Feature-Sliced Design 구조로 잡고 확장하는 규칙을 제공한다. 폴더 구조 설계, 새 화면·기능·엔티티 추가 위치 결정, 레이어 의존 규칙 검사, 구조 리팩터링, 확장 가능한 구조 요청을 처리할 때 사용한다. 구조와 무관한 단순 버그 수정에는 사용하지 않는다."
---

# FSD 아키텍처 규칙 — Next.js App Router

## 왜 이 구조인가

FSD는 "무엇을 하는 코드인가"(레이어)와 "무엇에 관한 코드인가"(슬라이스)로 두 번 나눈다. 폴더가 기능 단위로 닫히므로 기능을 추가할 때 손댈 위치가 한 곳으로 정해지고, 기능을 떼어낼 때 딸려 오는 것이 없다. 이 규칙이 무너지는 순간은 거의 항상 "급해서 옆 슬라이스 내부를 직접 import한 순간"이다.

## 디렉터리 구조

```
app/                        # Next.js App Router — 라우팅 전용. page/layout만 두는 얇은 어댑터
  layout.tsx                #   src/app/providers를 감싸기만 한다
  page.tsx                  #   src/views의 화면 컴포넌트를 렌더링만 한다
src/
  app/                      # FSD app 레이어 — 프로바이더, 전역 스타일, 전역 설정
    providers/              #   QueryClientProvider 등
    styles/                 #   globals.css, 디자인 토큰 CSS 변수
  views/                    # FSD pages 레이어 — 화면 조립 (Next의 pages와 이름 충돌을 피해 views로 둔다)
  widgets/                  # 여러 기능을 묶은 독립 화면 블록 (헤더, 목록 섹션)
  features/                 # 사용자 행동 단위 (검색, 필터, 좋아요)
  entities/                 # 도메인 단위 (product, user) — 타입, API 훅, 표현 컴포넌트
  shared/                   # 도메인을 모르는 재사용 코드
    api/                    #   supabase 클라이언트, 공통 요청 래퍼
    ui/                     #   Button, Card 같은 순수 UI
    lib/                    #   유틸, 훅
    config/                 #   env, 상수
supabase/                   # 마이그레이션과 시드 SQL
```

`app/`(라우팅)과 `src/app/`(FSD 레이어)을 분리하는 이유는 하나다. Next.js는 `app/` 아래 파일 이름으로 라우트를 만든다. 전역 프로바이더나 스타일을 같은 폴더에 두면 라우트가 아닌 파일이 라우트 규칙과 뒤섞여, 나중에 라우트 그룹을 나눌 때 무엇을 옮겨도 되는지 판단할 수 없게 된다.

## 레이어 의존 규칙

의존은 **위에서 아래로만** 흐른다.

```
app → views → widgets → features → entities → shared
```

| 규칙 | 내용 | 이유 |
| --- | --- | --- |
| 하향 의존만 허용 | 위 목록에서 자기보다 아래 레이어만 import한다 | 순환 참조를 구조적으로 막는다 |
| 같은 레이어 간 import 금지 | `features/a`가 `features/b`를 import하지 않는다 | 기능을 떼어낼 때 옆 기능이 딸려 온다 |
| 공개 API만 사용 | `entities/product/ui/Card`가 아니라 `entities/product`에서 가져온다 | 슬라이스 내부를 바꿔도 사용처가 깨지지 않는다 |
| `shared`는 아무것도 모른다 | `shared`에서 도메인 타입을 import하지 않는다 | `shared`가 도메인을 알면 재사용이 불가능해진다 |

같은 레이어의 두 슬라이스가 서로 필요하면 그것은 설계 신호다. 공통부를 아래 레이어로 내리거나, 둘을 조합하는 상위 레이어(widget)를 만든다.

## 슬라이스 내부 구조

```
entities/product/
  api/          # 데이터 조회 훅
  model/        # 타입, 상태
  ui/           # 표현 컴포넌트
  index.ts      # 공개 API — 외부에 노출할 것만 re-export
```

`index.ts`에는 실제로 밖에서 쓰는 것만 넣는다. 전부 re-export하면 공개 API를 둔 의미가 사라진다.

## 무엇을 어디에 둘지

| 추가하려는 것 | 위치 | 판단 기준 |
| --- | --- | --- |
| 라우트(URL) | `app/{route}/page.tsx` | 화면 로직은 넣지 않는다. `views`를 부르기만 한다 |
| 화면 전체 조립 | `src/views/{screen}` | 한 URL에 대응하는 조립 단위 |
| 재사용되는 화면 블록 | `src/widgets/{block}` | 두 화면 이상에서 쓰거나 독립적으로 의미 있는 블록 |
| 사용자 행동 | `src/features/{action}` | 동사로 이름이 붙는다(검색, 정렬, 담기) |
| 도메인 데이터와 표현 | `src/entities/{noun}` | 명사로 이름이 붙는다(상품, 사용자) |
| 도메인 무관 UI·유틸 | `src/shared/*` | 이 프로젝트가 아니어도 쓸 수 있는가로 판단한다 |

애매하면 아래 레이어가 아니라 **위 레이어**에 먼저 둔다. 위에서 아래로 내리는 리팩터링은 안전하지만, 아래에 잘못 둔 코드는 이미 여러 곳이 의존한 뒤라 내리기 어렵다.

## 확장할 때

- 화면 추가: `app/{route}/page.tsx` + `src/views/{screen}` 두 개만 만든다. 필요한 블록이 기존 위젯으로 충분하면 그 아래는 건드리지 않는다.
- 도메인 추가: `entities/{noun}` 슬라이스를 만들고 `api`/`model`/`ui`/`index.ts`를 갖춘다. 테이블 추가와 짝을 이룬다.
- 기능 추가: `features/{action}`을 만들고 필요한 entity만 import한다.
- 공통화: 두 번째 중복이 생기면 그때 `shared`로 올린다. 첫 번째 사용에서 미리 일반화하면 대개 틀린 추상이 된다.

## 구조 검사

레이어 위반은 눈으로 찾지 않는다. 다음 스크립트를 실행한다.

```bash
node .claude/skills/fsd-architecture/scripts/check-layer-imports.mjs
```

위반 목록을 `파일:줄`(구조 검사는 경로)로 출력하고, 위반이 있으면 종료 코드 1을 반환한다. QA 단계와 배포 전에 반드시 실행한다.

| 구분 | 잡는 것 | 수준 |
| --- | --- | --- |
| import | 하향 의존 위반, 같은 레이어 교차, 공개 API 우회, 테스트 누수(`test/` import). 정적·side-effect·동적 `import()`·`require` 모두 | 위반 |
| import | 라우트(`app/`)가 `views`·`src/app` 외 레이어를 직접 import. 단 API 라우트(`app/**/api/**/route.ts`)는 서버 공개 API(`index.server`)도 허용 | 경고 |
| 경계 | 클라이언트 파일(`'use client'`)이 서버 전용 모듈(`index.server`, `*.server.ts`, `'server-only'`를 import하는 파일)이나 `'server-only'`를 import | 위반 |
| 경계 | 클라이언트 공개 API(`index.ts`)가 서버 전용 모듈을 import·재수출 | 위반 |
| 경계 | `'server-only'`를 import하는데 이름이 `*.server.ts`가 아님, 또는 `*.server.ts`(`index.server` 제외)인데 `'server-only'`가 없음 | 경고 |
| 구조 | `src/` 바로 아래의 레이어 아닌 폴더·파일(`components/`, 오타 `widget/` 등. 비슷하면 "혹시 X?" 제안) | 위반 |
| 구조 | `views/widgets/features/entities` 바로 아래의 파일이나 세그먼트 이름 폴더, `index.ts(x)` 없는 슬라이스 | 위반 |
| 구조 | 슬라이스·`shared`의 1단계 폴더가 `ui, api, model, lib, config` 밖. `src/app`은 여기에 `providers, styles, api-routes` 추가 | 경고 |
| 구조 | 세그먼트 밖 파일: 슬라이스 루트의 `index`·`index.server`·`*.test.*` 외 파일, `shared`·`src/app` 루트의 파일 | 경고 |

서버 전용 코드(BFF)는 공개 API를 둘로 나눈다. `index.ts`는 클라이언트에서 import해도 안전한 것만, `index.server.ts`는 서버에서만 쓰는 것만 내보낸다(FSD 공식 Next.js 가이드의 "Server and client public APIs"). 서버 전용 파일은 `*.server.ts`로 짓고 맨 위에 `import 'server-only'`를 둔다. Route Handler 로직은 `src/app/api-routes/`에 두고 `app/api/**/route.ts`는 재수출만 한다. 자세한 규약은 `references/conventions.md` 7절.

테스트 파일은 대상 소스와 같은 세그먼트 폴더에 둔다(`references/testing.md`). `__tests__/` 폴더는 세그먼트 경고를 받는다. 허용 세그먼트를 늘려야 하면 스크립트의 `SEGMENTS`/`APP_SEGMENTS`에 이유 주석과 함께 추가한다.

## 참고

- 경로 별칭, tsconfig 설정, ESLint 연동, 네이밍 규칙: `references/conventions.md`
- 테스트 배치, 단계별 기준, 공용 테스트 도구(MSW·render 도우미): `references/testing.md`
