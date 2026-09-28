#!/usr/bin/env node
/**
 * FSD 레이어 의존 규칙·폴더 구조 검사기.
 *
 * import 검사 (정적 import/export, side-effect import, 동적 import(), require())
 *  1. 하향 의존 위반  — 하위 레이어가 상위 레이어를 import
 *  2. 같은 레이어 교차 — features/a 가 features/b 를 import
 *  3. 내부 깊은 참조   — 다른 슬라이스의 공개 API(index)를 거치지 않고 내부 파일을 직접 import
 *  4. 라우트 오염     — Next 라우트(app/)가 views/app 외 하위 레이어를 직접 import (경고).
 *                       API 라우트(app/api/**\/route.ts)는 src/app 과 서버 공개 API(index.server)도 허용
 *  5. 테스트 누수     — 테스트가 아닌 코드가 루트 test/(테스트 공용 환경)를 import
 *
 * 서버·클라이언트 경계 검사 (BFF, 06_architect_bff-design.md)
 *  S1. 클라이언트 파일('use client')이 서버 전용 모듈(index.server, *.server.*, 'server-only' 포함 파일)이나
 *      'server-only' 를 import
 *  S2. 클라이언트 공개 API(index.ts/tsx)가 서버 전용 모듈을 import·재수출
 *  S3. 서버 전용 파일 이름 — 'server-only' 를 import 하는데 *.server.ts(x) 이름이 아니거나,
 *      *.server.ts(x)(index.server 제외)인데 'server-only' 를 import 하지 않는다 (경고)
 *
 * 구조 검사 (src/ 폴더 트리)
 *  6. 알 수 없는 폴더  — src/ 바로 아래에 레이어(app, views, widgets, features, entities, shared)
 *                       이외의 폴더·파일. 레이어 이름과 비슷하면 "혹시 X?" 제안을 붙인다
 *  7. 슬라이스 아님    — views/widgets/features/entities 바로 아래의 파일, 또는 세그먼트 이름의 폴더
 *  8. 공개 API 없음    — views/widgets/features/entities 슬라이스에 index.ts / index.tsx 가 없다
 *  9. 세그먼트 이름    — 슬라이스, shared, src/app 의 1단계 폴더가 허용 목록 밖 (경고)
 * 10. 세그먼트 밖 파일 — 슬라이스 루트의 index·테스트 외 파일, shared·src/app 루트의 파일 (경고)
 *
 * 사용: node .claude/skills/fsd-architecture/scripts/check-layer-imports.mjs [프로젝트루트]
 * 종료 코드: 위반(error) 있으면 1, 없으면 0
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';

const ROOT = resolve(process.argv[2] ?? '.');
const SRC = join(ROOT, 'src');
const ROUTES = join(ROOT, 'app');

// 위 숫자가 클수록 상위 레이어. 상위만 하위를 import 할 수 있다.
const LAYERS = { app: 5, views: 4, widgets: 3, features: 2, entities: 1, shared: 0 };
// 슬라이스 단위로 닫히는 레이어. app/shared 는 세그먼트 구조라 제외한다.
const SLICED = new Set(['views', 'widgets', 'features', 'entities']);
const EXT = ['.ts', '.tsx', '.js', '.jsx'];

/**
 * 세그먼트 허용 목록
 *
 * - 슬라이스와 shared: FSD 표준 세그먼트 5개만 쓴다. 2단계 이하(shared/api/supabase 등)는 보지 않는다.
 * - src/app: 표준 5개 + providers, styles. FSD 관례상 app 레이어는 전역 프로바이더와 전역 스타일을
 *   자기 이름의 세그먼트로 둔다(FSD 문서의 app 세그먼트 예: providers, styles, routes, store, entrypoint).
 *   routes 는 넣지 않는다 — 라우팅은 루트 app/(Next)이 맡으므로 src/app/routes 는 라우팅 위치를 둘로 만든다.
 *   store·entrypoint 는 지금 쓸 곳이 없어 넣지 않았다. 필요해지면 이유와 함께 여기에 추가한다.
 *   src/app/ui 는 앱 전역 셸(site-shell) 자리로 표준 ui 세그먼트를 그대로 쓴다.
 */
const SEGMENTS = new Set(['ui', 'api', 'model', 'lib', 'config']);
// api-routes: FSD 공식 Next.js 가이드의 Route Handler 세그먼트(src/app/api-routes). app/api/**/route.ts 는
// 여기의 핸들러를 재수출만 한다. BFF 도입(06_architect_bff-design.md)과 함께 추가했다.
const APP_SEGMENTS = new Set([...SEGMENTS, 'providers', 'styles', 'api-routes']);
// index.server.ts(x): 서버 전용 공개 API. FSD 공식 Next.js 가이드의 "Server and client public APIs" 관례다.
// index.ts 는 클라이언트에서도 import 해도 안전한 것만, index.server.ts 는 서버에서만 쓰는 것만 내보낸다.
const INDEX_FILES = ['index.ts', 'index.tsx', 'index.server.ts', 'index.server.tsx'];
const CLIENT_INDEX_RE = /(^|\/)index\.tsx?$/;
const SERVER_NAME_RE = /(^|\/)[^/]+\.server(\.[jt]sx?)?$/; // index.server, get-products.server.ts …
const SERVER_ONLY_RE = /(?:^|\n)\s*import\s*['"]server-only['"]/;
const USE_CLIENT_RE = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*['"]use client['"]/;
const API_ROUTE_RE = /^app\/(?:.+\/)?api\/(?:.+\/)?route\.[jt]sx?$/;

// 정적 분기는 `import(` 를 제외(?!\s*\()하고 문장 끝(;)을 넘지 않게([^;]*?) 해서,
// 동적 import 뒤의 다른 문장 from 까지 넘어가 엉뚱한 경로를 잡지 않게 한다.
const IMPORT_RE = new RegExp(
  [
    String.raw`(?:^|\n)\s*(?:import|export)(?!\s*\()[^;]*?from\s*['"]([^'"]+)['"]`, // import/export ... from 'x'
    String.raw`(?:^|\n)\s*import\s*['"]([^'"]+)['"]`, // side-effect import 'x'
    String.raw`\bimport\(\s*['"]([^'"]+)['"]\s*\)`, // 동적 import('x')
    String.raw`\brequire\(\s*['"]([^'"]+)['"]\s*\)`, // require('x')
  ].join('|'),
  'g',
);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXT.some((e) => name.endsWith(e))) out.push(full);
  }
  return out;
}

/** 프로젝트 루트 기준 posix 경로로 정규화 */
function rel(file) {
  return relative(ROOT, file).split(sep).join('/');
}

/** 경로에서 레이어와 슬라이스를 뽑는다. src 밖이거나 레이어가 아니면 null (후자는 구조 검사가 위반으로 잡는다) */
function locate(relPath) {
  const parts = relPath.split('/');
  if (parts[0] === 'app') return { layer: 'routes', slice: parts[1] ?? '', rank: 6 };
  if (parts[0] !== 'src') return null;
  const layer = parts[1];
  if (!(layer in LAYERS)) return null;
  return { layer, slice: parts[2] ?? '', rank: LAYERS[layer], depth: parts.length };
}

/**
 * 테스트 파일(`*.test.ts(x)`, `*.spec.ts(x)`)과 루트 `test/`(테스트 공용 환경) 처리
 *
 * - 루트 `test/` 는 FSD 레이어가 아니다(MSW, fixtures, render 도우미). walk 대상(src, app)이 아니므로
 *   그 안의 import 는 검사하지 않는다. tsconfig 의 `@/test/*` 별칭은 `src/test` 가 아니라 이 폴더를 가리킨다.
 * - 소스 옆에 둔 테스트 파일은 검사에서 빼지 않는다. 테스트도 레이어 규칙(하향 의존, 공개 API)을
 *   지켜야 슬라이스를 옮기거나 떼어낼 때 테스트가 딸려 오지 않는다. 테스트 파일이 `@/test/...` 를
 *   import 하는 것은 레이어 밖 참조이므로 허용한다.
 * - 반대로 테스트가 아닌 앱 코드가 `test/` 를 import 하면 위반이다. 테스트 도우미(MSW, fixtures)가
 *   번들에 들어간다.
 * - 구조 검사: 테스트 파일은 대상 소스와 같은 세그먼트 폴더에 둔다(references/testing.md). 세그먼트
 *   검사는 폴더 이름만 보므로 세그먼트 안 테스트 파일은 영향이 없다. 슬라이스 루트의 테스트 파일
 *   (예: index.test.ts — 공개 API 테스트)은 허용한다. `__tests__` 같은 폴더는 세그먼트가 아니므로 경고한다.
 */
const TEST_FILE_RE = /\.(test|spec)\.[jt]sx?$/;
const isTestSupport = (target) => target === 'test' || target.startsWith('test/');

/** import 문자열을 프로젝트 루트 기준 경로로 바꾼다. 외부 패키지면 null */
function resolveSpec(spec, fromFile) {
  if (spec === '@/test' || spec.startsWith('@/test/')) return spec.slice(2); // → test/... (루트)
  if (spec.startsWith('@/')) return 'src/' + spec.slice(2);
  if (spec.startsWith('~/')) return 'src/' + spec.slice(2);
  if (spec.startsWith('.')) {
    const abs = resolve(dirname(fromFile), spec);
    const r = rel(abs);
    return r.startsWith('..') ? null : r;
  }
  if (spec.startsWith('src/') || spec.startsWith('app/')) return spec;
  return null; // 외부 패키지
}

/** 루트 기준 경로(확장자 없을 수 있음)를 실제 파일로 찾는다. 없으면 null */
function resolveFile(target) {
  const abs = join(ROOT, target);
  const candidates = [abs, ...EXT.map((e) => abs + e), ...EXT.map((e) => join(abs, 'index' + e))];
  for (const c of candidates) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
}

const serverOnlyCache = new Map();
/** 파일이 'server-only' 를 import 하는가 */
function importsServerOnly(absFile) {
  if (!serverOnlyCache.has(absFile)) serverOnlyCache.set(absFile, SERVER_ONLY_RE.test(readFileSync(absFile, 'utf8')));
  return serverOnlyCache.get(absFile);
}

/**
 * 서버 전용 모듈인가. 이름(index.server, *.server.*)으로 먼저 보고, 이름이 규칙을 어겼어도
 * 파일이 'server-only' 를 import 하면 서버 전용으로 본다(S3 가 이름을 따로 경고한다).
 */
function isServerModule(target) {
  if (SERVER_NAME_RE.test(target.replace(/\.[jt]sx?$/, ''))) return true;
  const file = resolveFile(target);
  return file ? importsServerOnly(file) : false;
}

const findings = [];

// ─── import 검사 ──────────────────────────────────────────────────────────────
const files = [...walk(SRC), ...walk(ROUTES)];

for (const file of files) {
  const relFile = rel(file);
  const from = locate(relFile);
  if (!from) continue;
  const text = readFileSync(file, 'utf8');
  const isTest = TEST_FILE_RE.test(relFile);
  const isClientFile = USE_CLIENT_RE.test(text);
  const isClientIndex = relFile.startsWith('src/') && CLIENT_INDEX_RE.test(relFile);
  const isApiRoute = API_ROUTE_RE.test(relFile);

  // S3: 서버 전용 파일 이름 규칙 (src 만. 테스트 파일은 제외)
  if (relFile.startsWith('src/') && !isTest) {
    const stemPath = relFile.replace(/\.[jt]sx?$/, '');
    const named = SERVER_NAME_RE.test(stemPath);
    const marked = SERVER_ONLY_RE.test(text);
    const note = (msg, detail) => findings.push({ kind: 'import', level: 'warn', at: relFile, msg, detail });
    if (marked && !named) {
      note("'server-only'를 import하는 파일은 이름을 *.server.ts(x)로 짓는다",
        '이름으로 서버 전용임을 드러내야 검사(S1·S2)와 사람이 import 경계를 알아본다');
    } else if (named && !marked && !/(^|\/)index\.server$/.test(stemPath)) {
      note("*.server.ts(x) 파일인데 'server-only'를 import하지 않는다",
        "파일 맨 위에 import 'server-only' 를 넣어야 클라이언트 번들에 들어갈 때 빌드가 멈춘다");
    }
  }

  for (const m of text.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2] ?? m[3] ?? m[4];
    if (!spec) continue;

    // 매치가 앞 줄의 개행에서 시작할 수 있으므로 선행 공백을 건너뛴 위치로 줄 번호를 센다
    const lead = m[0].length - m[0].trimStart().length;
    const line = text.slice(0, m.index + lead).split('\n').length;
    const at = `${relFile}:${line}`;
    const push = (level, msg) => findings.push({ kind: 'import', level, at, msg, detail: `import "${spec}"` });

    if (spec === 'server-only') {
      if (isClientFile) push('error', "클라이언트 파일('use client')이 'server-only'를 import했다");
      continue;
    }

    const target = resolveSpec(spec, file);
    if (!target) continue;

    if (isTestSupport(target)) {
      if (!isTest) push('error', '테스트가 아닌 코드가 테스트 공용 환경(test/)을 import했다');
      continue;
    }

    // S1·S2: 서버·클라이언트 경계. 레이어 방향과 별개로 먼저 본다
    const serverTarget = target.startsWith('src/') && isServerModule(target);
    if (serverTarget && isClientFile) {
      push('error', "클라이언트 파일('use client')이 서버 전용 모듈을 import했다. 브라우저 번들에 서버 코드·환경 변수가 들어간다");
    } else if (serverTarget && isClientIndex) {
      push('error', '클라이언트 공개 API(index.ts)가 서버 전용 모듈을 내보낸다. 같은 폴더의 index.server.ts로 옮긴다');
    }

    const to = locate(target);
    if (!to) continue;

    if (from.layer === 'routes') {
      // API 라우트는 src/app/api-routes 재수출이 기본이고, 서버 공개 API(index.server) 직접 import도 허용한다
      const allowedForApi = isApiRoute && serverTarget;
      if (to.rank <= LAYERS.widgets && !allowedForApi) {
        push('warn', isApiRoute
          ? `API 라우트는 src/app/api-routes 또는 서버 공개 API(index.server)만 import한다 (현재: ${to.layer})`
          : `라우트 파일은 src/views 또는 src/app만 import한다 (현재: ${to.layer})`);
      }
      continue;
    }

    if (to.rank > from.rank) {
      push('error', `하위 레이어(${from.layer})가 상위 레이어(${to.layer})를 import했다`);
      continue;
    }

    if (to.rank === from.rank && SLICED.has(from.layer) && from.slice !== to.slice) {
      push('error', `같은 레이어의 다른 슬라이스를 import했다 (${from.layer}/${from.slice} → ${to.slice})`);
      continue;
    }

    // 공개 API 우회: 다른 슬라이스의 내부 세그먼트를 직접 참조
    if (SLICED.has(to.layer) && to.slice && !(to.layer === from.layer && to.slice === from.slice)) {
      const parts = target.split('/');           // src/<layer>/<slice>/<...>
      const rest = parts.slice(3).join('/');
      // index.server 는 서버 전용 공개 API라 우회가 아니다(서버·클라이언트 경계는 S1·S2 가 따로 본다)
      const viaIndex = rest === '' || /^index(\.server)?(\.tsx?)?$/.test(rest);
      if (!viaIndex) {
        push('error', `슬라이스 내부를 직접 참조했다. '@/${to.layer}/${to.slice}' 또는 '@/${to.layer}/${to.slice}/index.server' 공개 API를 사용한다`);
      }
    }
  }
}

// ─── 구조 검사 ────────────────────────────────────────────────────────────────
/** 편집 거리(Levenshtein) */
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

/** 단수형: entities → entity, widgets → widget */
const singular = (w) => (w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.endsWith('s') ? w.slice(0, -1) : w);
const stem = (name) => name.toLowerCase().replace(/\.[^.]+$/, '');

// 철자는 멀어도 뜻으로 대응되는 이름. pages 는 FSD 원래 이름이고, 이 프로젝트는 Next 와의 충돌을 피해 views 로 쓴다.
const ALIASES = { pages: 'views', page: 'views', screens: 'views', screen: 'views' };

/** name 과 가까운 후보. 대소문자 차이, 단수·복수, 편집 거리 2 이하, 별칭 순으로 본다 */
function suggest(name, candidates) {
  const n = stem(name);
  if (ALIASES[n] && candidates.includes(ALIASES[n])) return ALIASES[n];
  let best = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = singular(n) === singular(c) ? 0 : distance(n, c);
    if (d < bestD) [best, bestD] = [c, d];
  }
  return bestD <= 2 ? best : null;
}

/** 흔한 비FSD 폴더 이름을 어디로 옮길지 안내한다 */
const RELOCATE = {
  components: '도메인 무관 UI는 shared/ui, 도메인 UI는 해당 슬라이스의 ui 세그먼트',
  hooks: '도메인 무관 훅은 shared/lib, 조회 훅은 entities/*/api, 상태 훅은 슬라이스의 model',
  utils: 'shared/lib 또는 슬라이스의 lib 세그먼트',
  helpers: 'shared/lib 또는 슬라이스의 lib 세그먼트',
  types: '슬라이스의 model 세그먼트 (도메인 무관 타입은 shared/lib 또는 shared/api)',
  constants: 'shared/config 또는 슬라이스의 config 세그먼트',
  services: 'shared/api 또는 entities/*/api',
  store: '슬라이스의 model 세그먼트',
  styles: 'src/app/styles (전역) 또는 컴포넌트 옆',
  assets: 'public/ (정적 파일) 또는 shared/ui',
  test: '루트 test/ (테스트 공용 환경)',
  tests: '루트 test/ (공용 환경), 개별 테스트는 소스 옆 *.test.ts(x)',
  __tests__: '소스와 같은 세그먼트 폴더의 *.test.ts(x) (references/testing.md)',
};

function hintFor(name, candidates, label) {
  const s = suggest(name, candidates);
  if (s) return `혹시 ${label} '${s}'?`;
  const where = RELOCATE[stem(name)];
  return where ? `옮길 곳: ${where}` : null;
}

const listDir = (dir) =>
  readdirSync(dir)
    .filter((name) => !name.startsWith('.') && name !== 'node_modules')
    .map((name) => ({ name, dir: statSync(join(dir, name)).isDirectory() }));

const struct = (level, at, msg, detail) => findings.push({ kind: 'struct', level, at, msg, detail });
let sliceCount = 0;

/** 세그먼트 계층(슬라이스, shared, src/app)의 1단계를 본다. isSlice 면 루트의 index·테스트 파일을 허용한다 */
function checkSegments(dir, base, allowed, owner, isSlice) {
  for (const e of listDir(dir)) {
    const at = `${base}/${e.name}${e.dir ? '/' : ''}`;
    if (e.dir) {
      if (!allowed.has(e.name)) {
        struct('warn', at, `${owner}의 세그먼트 이름이 아니다 (허용: ${[...allowed].join(', ')})`,
          hintFor(e.name, [...allowed], '세그먼트'));
      }
    } else if (!(isSlice && (INDEX_FILES.includes(e.name) || TEST_FILE_RE.test(e.name)))) {
      struct('warn', at, `${owner} 루트에 세그먼트 밖 파일이 있다. 세그먼트 폴더 안으로 옮긴다`);
    }
  }
}

if (existsSync(SRC)) {
  const layerNames = Object.keys(LAYERS);
  for (const e of listDir(SRC)) {
    const base = `src/${e.name}`;
    if (!e.dir || !(e.name in LAYERS)) {
      struct('error', e.dir ? `${base}/` : base,
        `src/ 바로 아래에는 레이어(${layerNames.join(', ')})만 둔다. 이 ${e.dir ? '폴더' : '파일'}는 레이어 검사에서 빠진다`,
        hintFor(e.name, layerNames, '레이어'));
      continue;
    }
    const layerDir = join(SRC, e.name);
    if (!SLICED.has(e.name)) {
      const owner = e.name === 'app' ? 'src/app' : 'shared';
      checkSegments(layerDir, base, e.name === 'app' ? APP_SEGMENTS : SEGMENTS, owner, false);
      continue;
    }
    for (const s of listDir(layerDir)) {
      const sliceBase = `${base}/${s.name}`;
      if (!s.dir) {
        struct('error', sliceBase, `${e.name} 레이어 바로 아래에는 슬라이스 폴더만 둔다`,
          `옮길 곳: ${base}/<슬라이스>/<세그먼트>/`);
        continue;
      }
      if (SEGMENTS.has(s.name)) {
        struct('error', `${sliceBase}/`,
          `'${s.name}'는 세그먼트 이름이다. ${e.name} 레이어에는 슬라이스를 두고 그 안에 세그먼트를 둔다`,
          `옮길 곳: ${base}/<슬라이스>/${s.name}/`);
        continue;
      }
      sliceCount++;
      const sliceDir = join(layerDir, s.name);
      if (!INDEX_FILES.some((f) => existsSync(join(sliceDir, f)))) {
        struct('error', `${sliceBase}/`, '슬라이스에 공개 API(index.ts 또는 index.tsx)가 없다',
          `외부에 노출할 것만 re-export하는 ${sliceBase}/index.ts 를 만든다`);
      }
      checkSegments(sliceDir, sliceBase, SEGMENTS, `슬라이스 ${e.name}/${s.name}`, true);
    }
  }
}

// ─── 출력 ─────────────────────────────────────────────────────────────────────
const errors = findings.filter((f) => f.level === 'error');
const warns = findings.filter((f) => f.level === 'warn');
const count = (list, kind) => list.filter((f) => f.kind === kind).length;

if (!findings.length) {
  console.log(`FSD 레이어 검사 통과 — 파일 ${files.length}개 · 슬라이스 ${sliceCount}개 · 구조 위반·경고 없음`);
  process.exit(0);
}
for (const f of [...errors, ...warns]) {
  console.log(`${f.level === 'error' ? '[위반]' : '[경고]'} ${f.at}\n        ${f.msg}${f.detail ? `\n        ${f.detail}` : ''}`);
}
console.log(
  `\n검사 파일 ${files.length}개 · 슬라이스 ${sliceCount}개 · ` +
    `위반 ${errors.length}건(import ${count(errors, 'import')} · 구조 ${count(errors, 'struct')}) · ` +
    `경고 ${warns.length}건(import ${count(warns, 'import')} · 구조 ${count(warns, 'struct')})`,
);
process.exit(errors.length ? 1 : 0);
