#!/usr/bin/env node
/**
 * FSD 레이어 의존 규칙 검사기.
 *
 * 검사 항목
 *  1. 하향 의존 위반  — 하위 레이어가 상위 레이어를 import
 *  2. 같은 레이어 교차 — features/a 가 features/b 를 import
 *  3. 내부 깊은 참조   — 다른 슬라이스의 공개 API(index)를 거치지 않고 내부 파일을 직접 import
 *  4. 라우트 오염     — Next 라우트(app/)가 views/app 외 하위 레이어를 직접 import (경고)
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

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;

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

/** 경로에서 레이어와 슬라이스를 뽑는다. src 밖이면 null */
function locate(relPath) {
  const parts = relPath.split('/');
  if (parts[0] === 'app') return { layer: 'routes', slice: parts[1] ?? '', rank: 6 };
  if (parts[0] !== 'src') return null;
  const layer = parts[1];
  if (!(layer in LAYERS)) return null;
  return { layer, slice: parts[2] ?? '', rank: LAYERS[layer], depth: parts.length };
}

/** import 문자열을 프로젝트 루트 기준 경로로 바꾼다. 외부 패키지면 null */
function resolveSpec(spec, fromFile) {
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

const findings = [];
const files = [...walk(SRC), ...walk(ROUTES)];

for (const file of files) {
  const relFile = rel(file);
  const from = locate(relFile);
  if (!from) continue;
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');

  for (const m of text.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2];
    if (!spec) continue;
    const target = resolveSpec(spec, file);
    if (!target) continue;
    const to = locate(target);
    if (!to) continue;

    const line = text.slice(0, m.index).split('\n').length;
    const at = `${relFile}:${line}`;
    const push = (level, msg) => findings.push({ level, at, msg, spec });

    if (from.layer === 'routes') {
      if (to.rank <= LAYERS.widgets) {
        push('warn', `라우트 파일은 src/views 또는 src/app만 import한다 (현재: ${to.layer})`);
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
      const viaIndex = rest === '' || rest === 'index' || rest === 'index.ts' || rest === 'index.tsx';
      if (!viaIndex) {
        push('error', `슬라이스 내부를 직접 참조했다. '@/${to.layer}/${to.slice}' 공개 API를 사용한다`);
      }
    }
  }
}

const errors = findings.filter((f) => f.level === 'error');
const warns = findings.filter((f) => f.level === 'warn');

if (!findings.length) {
  console.log(`FSD 레이어 검사 통과 — 파일 ${files.length}개`);
  process.exit(0);
}
for (const f of [...errors, ...warns]) {
  console.log(`${f.level === 'error' ? '[위반]' : '[경고]'} ${f.at}\n        ${f.msg}\n        import "${f.spec}"`);
}
console.log(`\n검사 파일 ${files.length}개 · 위반 ${errors.length}건 · 경고 ${warns.length}건`);
process.exit(errors.length ? 1 : 0);
