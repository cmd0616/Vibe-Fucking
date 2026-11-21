#!/usr/bin/env node
/**
 * Vibe-Fucking — Step 0 探针（calibration probe）
 *
 * 用途：在动手写规则前，用最低成本验证「AI 屎山指纹」假设是否成立，
 *       并把各规则的阈值量级测出来。
 *
 * 实现：纯正则 / 词法统计，零依赖。会误报，只用于判断量级，不用于判定。
 *
 * 用法：
 *   node scripts/probe.mjs <项目路径> [项目路径2 ...]
 *
 * 建议：同时跑一个「AI 生成项目」和一个「已知优质开源项目」做对照，
 *       看两组数字是否存在显著差异。
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, extname, basename, resolve } from 'node:path';

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', 'coverage', '.next', 'out',
  'vendor', '.turbo', '__snapshots__', '.cache', 'public', 'assets',
]);
const SRC_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);

/* ---------------------------------- 工具 ---------------------------------- */

const count = (src, re) => (src.match(re) || []).length;
const per = (n, kloc) => (kloc > 0 ? (n / kloc).toFixed(1) : '0.0');

const cjkWidth = (s) =>
  [...s].reduce((w, c) => w + (/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(c) ? 2 : 1), 0);
const padEnd = (s, n) => s + ' '.repeat(Math.max(0, n - cjkWidth(String(s))));
const padStart = (s, n) => ' '.repeat(Math.max(0, n - cjkWidth(String(s)))) + s;

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(p, out);
    } else if (SRC_EXTS.has(extname(e.name))) {
      out.push(p);
    }
  }
  return out;
}

/* -------------------------------- 分析函数 -------------------------------- */

/** 空 catch / 只 log 的 catch */
function analyzeCatch(src) {
  const re = /catch\s*(?:\([^)]*\))?\s*\{/g;
  let m;
  let empty = 0;
  let onlyLog = 0;
  while ((m = re.exec(src))) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      i++;
    }
    const body = src
      .slice(re.lastIndex, i - 1)
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();
    if (!body) empty++;
    else if (/^console\.(log|error|warn|info)\([\s\S]*\);?$/.test(body)) onlyLog++;
  }
  re.lastIndex = 0;
  return { empty, onlyLog };
}

/** 纯转发函数（函数体只有一行 return 调用另一个函数） */
function analyzeForwarder(src) {
  const patterns = [
    /function\s+\w+\s*\([^)]*\)[^{;]*\{\s*return\s+[\w.$]+\([^)]*\)\s*;?\s*\}/g,
    /const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*[\w.$]+\([^)]*\)\s*;?/g,
    /\b(\w+)\s*\([^)]*\)\s*(?::\s*[^{;]+)?\{\s*return\s+this\.[\w.]+\([^)]*\)\s*;?\s*\}/g,
  ];
  return patterns.reduce((n, re) => n + count(src, re), 0);
}

/**
 * 重复代码块：5 行滑动窗口，归一化后统计冗余出现次数。
 * 保留 `try {` 这类短行（否则 AI 常见的重试样板检不出来），
 * 但要求窗口内至少有一行实质代码（> 15 字符），避免纯大括号误报。
 */
function analyzeDuplication(contents, window = 5) {
  const WINDOW = window;
  const seen = new Map();
  for (const src of contents.values()) {
    const lines = src
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !/^(\/\/|\*|\/\*|import\b)/.test(l));
    for (let i = 0; i + WINDOW <= lines.length; i++) {
      const slice = lines.slice(i, i + WINDOW);
      if (!slice.some((l) => l.length > 15)) continue;
      const key = slice
        .join('\n')
        .replace(/\b\d+\b/g, 'N')
        .replace(/'[^']*'/g, 'S')
        .replace(/"[^"]*"/g, 'S');
      seen.set(key, (seen.get(key) || 0) + 1);
    }
  }
  let redundant = 0;
  for (const v of seen.values()) if (v > 1) redundant += v - 1;
  return redundant;
}

/** 未使用导出（粗估：全项目搜不到第二个引用点） */
function analyzeUnusedExports(contents) {
  const exported = [];
  const re = /export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  for (const [path, src] of contents) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(src))) exported.push({ name: m[1], path });
  }
  let unused = 0;
  for (const { name, path } of exported) {
    const probe = new RegExp(`\\b${name}\\b`);
    const global = new RegExp(`\\b${name}\\b`, 'g');
    let used = false;
    for (const [p2, src2] of contents) {
      if (p2 === path) {
        if (count(src2, global) > 1) {
          used = true;
          break;
        }
      } else if (probe.test(src2)) {
        used = true;
        break;
      }
    }
    if (!used) unused++;
  }
  return { total: exported.length, unused };
}

/** 依赖：总数与未使用数 */
function analyzeDeps(root, contents) {
  const pj = join(root, 'package.json');
  if (!existsSync(pj)) return { total: 0, unused: 0, has: false };
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pj, 'utf8'));
  } catch {
    return { total: 0, unused: 0, has: false };
  }
  const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  const all = [...contents.values()].join('\n');
  const unused = names.filter((n) => {
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return !new RegExp(`from\\s+['"]${esc}(/[^'"]*)?['"]|require\\(['"]${esc}`).test(all);
  });
  return { total: names.length, unused: unused.length, names: unused, has: true };
}

/* --------------------------------- 主流程 --------------------------------- */

function analyze(root) {
  const files = walk(root);
  const contents = new Map();
  let lines = 0;
  let codeLines = 0;
  let testFiles = 0;

  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    contents.set(f, src);
    const ls = src.split('\n');
    lines += ls.length;
    codeLines += ls.filter((l) => l.trim() && !/^\s*(\/\/|\*|\/\*)/.test(l)).length;
    if (/\.(test|spec)\.[jt]sx?$/.test(f) || f.includes('__tests__')) testFiles++;
  }

  const all = [...contents.values()].join('\n');
  const kloc = codeLines / 1000;

  let emptyCatch = 0;
  let onlyLogCatch = 0;
  let forwarders = 0;
  for (const src of contents.values()) {
    const c = analyzeCatch(src);
    emptyCatch += c.empty;
    onlyLogCatch += c.onlyLog;
    forwarders += analyzeForwarder(src);
  }

  const { total: exportsTotal, unused: unusedExports } = analyzeUnusedExports(contents);
  const deps = analyzeDeps(root, contents);

  return {
    files: files.length,
    lines,
    codeLines,
    testFiles,
    kloc,
    interfaceDecls: count(all, /^\s*(export\s+)?interface\s+\w+/gm),
    implementsHits: count(all, /\bimplements\b/g),
    exportsTotal,
    unusedExports,
    forwarders,
    emptyCatch,
    onlyLogCatch,
    anyHits: count(all, /:\s*any\b|\bas\s+any\b|<any>/g),
    assertHits: count(all, /\bas\s+[A-Za-z_$][\w$<>,\[\]\s]*?(?=[\s;),\]])/g),
    tsIgnore: count(all, /@ts-(ignore|nocheck|expect-error)/g),
    consoleLog: count(all, /console\.(log|debug|info)\(/g),
    todo: count(all, /\/\/\s*(TODO|FIXME|HACK|XXX)/gi),
    dupBlocks: analyzeDuplication(contents),
    deps,
  };
}

/* --------------------------------- 输出 ----------------------------------- */

const ROWS = [
  ['源文件数', (m) => m.files, ''],
  ['代码行数', (m) => m.codeLines, ''],
  ['平均文件行数', (m) => (m.files ? Math.round(m.lines / m.files) : 0), '>300 偏高'],
  ['测试文件数', (m) => m.testFiles, '0 即无测试'],
  ['interface 声明数', (m) => m.interfaceDecls, ''],
  ['implements 次数', (m) => m.implementsHits, '远小于上项=仪式抽象'],
  ['纯转发函数(估)', (m) => m.forwarders, ''],
  ['未使用导出', (m) => `${m.unusedExports}/${m.exportsTotal}`, '占比>20% 异常'],
  ['空 catch', (m) => m.emptyCatch, ''],
  ['只 log 的 catch', (m) => m.onlyLogCatch, ''],
  ['any 出现次数', (m) => m.anyHits, (m) => `/千行: ${per(m.anyHits, m.kloc)}`],
  ['as 断言次数', (m) => m.assertHits, (m) => `/千行: ${per(m.assertHits, m.kloc)}`],
  ['@ts-ignore', (m) => m.tsIgnore, ''],
  ['console.log', (m) => m.consoleLog, (m) => `/千行: ${per(m.consoleLog, m.kloc)}`],
  ['TODO/FIXME', (m) => m.todo, (m) => `/千行: ${per(m.todo, m.kloc)}`],
  ['重复代码块(5行窗口)', (m) => m.dupBlocks, '>10 明显复制粘贴'],
  ['依赖总数', (m) => m.deps.total, ''],
  ['未使用依赖', (m) => m.deps.unused, ''],
];

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('用法: node scripts/probe.mjs <项目路径> [项目路径2 ...]');
    process.exit(2);
  }

  const projects = args.map((a) => {
    const root = resolve(a);
    return { name: basename(root), root, metrics: analyze(root) };
  });

  const COL = 16;
  console.log('\n🔍 Vibe-Fucking 探针 — 屎山指纹密度统计（粗粒度正则，仅供量级参考）\n');
  console.log(padEnd('指标', 24) + projects.map((p) => padStart(p.name, COL)).join(''));
  console.log('-'.repeat(24 + COL * projects.length));

  for (const [label, get, hint] of ROWS) {
    const values = projects.map((p) => padStart(String(get(p.metrics)), COL)).join('');
    console.log(padEnd(label, 24) + values + (hint ? `   ${typeof hint === 'function' ? hint(projects[0].metrics) : hint}` : ''));
  }

  if (projects.length > 1) {
    console.log('\n对照要点：AI 生成项目应在「未使用导出、空 catch、any/千行、TODO/千行、重复块」上显著高于优质项目。');
  } else {
    console.log('\n提示：再跑一个已知优质项目做对照（node scripts/probe.mjs 项目A 项目B），差异才有意义。');
  }
  console.log('');
}

main();
