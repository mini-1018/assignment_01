---
name: deploy-github-vercel
description: "Next.js 프로젝트를 GitHub 저장소에 올리고 Vercel로 배포하는 절차를 제공한다. 깃 초기화, 원격 저장소 생성, 커밋·푸시, Vercel 연동, 환경 변수 설정, 배포 실행, 배포 실패 원인 분석을 요청받으면 사용한다. 로컬 개발 서버 실행이나 빌드 오류 자체의 수정에는 사용하지 않는다."
---

# GitHub + Vercel 배포 절차

## 되돌릴 수 없는 작업이다

저장소 생성, 푸시, 배포는 외부에 코드를 공개하는 동작이다. 삭제해도 캐시와 포크에는 남는다. **실행 전에 사용자에게 저장소 이름, 공개 범위(public/private), 올라갈 내용을 알리고 승인을 받는다.** 승인 없이 진행하지 않는다.

## 1단계: 공개 전 점검

푸시 전에 반드시 확인한다.

```bash
git status --porcelain
git check-ignore -v .env.local        # 무시 대상이어야 한다
git ls-files | grep -iE "\.env|secret|credential|key" || echo "자격 증명 파일 없음"
```

`.gitignore`에 최소한 다음이 있어야 한다.

```
node_modules/
.next/
.env*.local
.vercel
```

- anon 키는 공개돼도 되는 값이지만, service_role 키·데이터베이스 비밀번호·개인 토큰은 절대 커밋하지 않는다.
- 이미 커밋된 뒤라면 되돌리는 것으로 끝나지 않는다. 해당 키를 폐기하고 새로 발급받게 안내한다.

## 2단계: 로컬 저장소

```bash
git init -b main
git add -A
git commit -m "feat: 초기 구조와 화면 구현"
```

커밋 메시지는 Conventional Commits를 따른다. 초기 커밋 하나에 전부 담지 말고, 구조/데이터/화면처럼 의미 단위로 나누면 배포 실패 시 원인 범위를 좁힐 수 있다.

## 3단계: GitHub

```bash
gh auth status                                   # 로그인 확인
gh repo create {이름} --private --source=. --remote=origin --push
```

- `gh`가 없거나 로그인돼 있지 않으면 직접 로그인하려 하지 않는다. 사용자에게 `! gh auth login`을 안내하고 기다린다. 대화형 인증은 이 환경에서 진행할 수 없다.
- 이미 `origin`이 있으면 새로 만들지 않고 `git push -u origin main`만 한다.

## 4단계: Vercel 연결

두 가지 방법이 있다. 기본은 A다.

**A. Git 연동(권장)** — Vercel 대시보드에서 저장소를 Import한다. 이후 `main` 푸시마다 자동 배포되고, PR마다 미리보기 배포가 생긴다. 사용자가 대시보드에서 해야 하는 단계이므로 무엇을 클릭해야 하는지 안내한다.

**B. CLI 배포**

```bash
vercel link                # 프로젝트 연결
vercel --prod              # 프로덕션 배포
```

CLI는 로컬 파일을 그대로 올리므로 커밋되지 않은 변경도 배포된다. 저장소와 배포본이 달라질 수 있으니 A와 섞어 쓰지 않는다.

## 5단계: 환경 변수

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
```

- Production / Preview / Development 환경마다 따로 등록해야 한다. Production에만 넣고 미리보기 배포가 빈 화면이 되는 일이 흔하다.
- 환경 변수를 추가하거나 바꾼 뒤에는 **재배포해야** 반영된다. 빌드 시점에 번들에 박히기 때문이다.
- 보고서에는 변수 이름만 적는다. 값은 어떤 파일에도 기록하지 않는다.

## 6단계: 배포 확인

배포 성공 메시지만 보고 끝내지 않는다.

```bash
curl -s -o /dev/null -w "%{http_code}" {배포 URL}
```

1. 200이 아니면 빌드는 됐어도 런타임에서 실패한 것이다. Vercel 런타임 로그를 확인한다.
2. 데이터가 보이는지 확인한다. 로컬에서 되고 배포본만 비었다면 원인은 거의 항상 환경 변수 누락이다.
3. 배포 URL과 커밋 해시를 `_workspace/05_deploy_report.md`에 남긴다.

## 배포 실패 원인 찾기

| 증상 | 흔한 원인 |
| --- | --- |
| 빌드 중 타입 오류 | 로컬에서 타입 검사를 건너뛰었다. `npx tsc --noEmit`을 먼저 돌린다 |
| 모듈을 찾을 수 없음 | 경로 대소문자. 로컬 Windows는 통과하지만 Vercel의 리눅스 빌드는 실패한다 |
| 빈 화면, 콘솔에 supabase 오류 | Vercel 환경 변수 미등록 또는 등록 후 재배포 안 함 |
| 로컬은 되는데 빌드만 실패 | `.env.local`에만 있는 값에 의존하고 있다 |
| 404 | 라우트 파일 위치가 `app/{경로}/page.tsx`가 아니다 |

프레임워크 설정이나 타입 검사를 꺼서 빌드를 통과시키지 않는다. 통과한 것이 아니라 확인을 포기한 것이다.
