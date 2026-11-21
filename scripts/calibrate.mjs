#!/usr/bin/env node
/**
 * 3b 校准聚合器：对一组真实仓库跑 `vf scan --format json`，输出对比表。
 *
 * 用法：
 *   node scripts/calibrate.mjs <repo1> [repo2 ...]
 *
 * 输出：每个仓库的文件数、代码行、SMI、等级、各维度分、以及按规则计数的 Top 问题。
 * 把这张表贴回对话，即可校准阈值与评分尺度。
 */
import { execSync } from 'node:child_process';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../packages/cli/src/index.ts', import.meta.url));

function scan(path) {
  // 走 shell 执行，Windows 下才能解析到 npx.cmd
  const out = execSync(`npx tsx "${CLI}" scan "${path}" --format json`, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const json = out.slice(out.indexOf('{'));
  return JSON.parse(json);
}

function short(name) {
  return name.length > 22 ? name.slice(0, 21) + '…' : name;
}

const rows = [];
for (const path of process.argv.slice(2)) {
  let r;
  try {
    r = scan(path);
  } catch (e) {
    console.error(`✗ ${path}: ${(e.stderr || e.message).split('\n')[0]}`);
    continue;
  }
  const byRule = {};
  for (const i of r.issues) byRule[i.ruleId] = (byRule[i.ruleId] || 0) + 1;
  rows.push({ path, r, byRule });
}

if (rows.length === 0) {
  console.error('没有可用结果。用法: node scripts/calibrate.mjs <repo1> [repo2 ...]');
  process.exit(1);
}

const dimKeys = ['structure', 'abstraction', 'errorHandling', 'typing', 'hygiene', 'engineering'];

console.log('\n=== Vibe-Fucking 校准对比表 ===\n');
for (const { path, r, byRule } of rows) {
  const name = short(relative(process.cwd(), path) || path);
  console.log(`■ ${name}  (${r.fileCount} 文件 / ${r.codeLines} 行)`);
  console.log(`  SMI ${r.smi}/100  ${r.level.name}`);
  const dim = dimKeys
    .map((k) => {
      const d = r.dimensions.find((x) => x.dimension === k);
      return `${k.slice(0, 4)}:${d ? d.score : '-'}`;
    })
    .join('  ');
  console.log(`  维度 ${dim}`);
  const top = Object.entries(byRule)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k, v]) => `${k}=${v}`)
    .join('  ');
  console.log(`  Top 问题 ${top}`);
  console.log('');
}
