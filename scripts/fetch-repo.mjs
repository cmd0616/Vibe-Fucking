#!/usr/bin/env node
/**
 * 通过 GitHub API 逐文件下载仓库源码（绕开 git pack 协议在网络不稳时的断连）。
 * 只取源码文件，跳过图片/锁文件/文档，体积可控。
 *
 * 用法：node scripts/fetch-repo.mjs <owner/repo> <目标目录>
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const [repo, destArg] = process.argv.slice(2);
if (!repo || !destArg) {
  console.error('用法: node scripts/fetch-repo.mjs <owner/repo> <目标目录>');
  process.exit(1);
}

const headers = { 'User-Agent': 'vf-calibration', Accept: 'application/vnd.github+json' };
const token = process.env.GITHUB_TOKEN;
if (token) headers.Authorization = `Bearer ${token}`;

async function api(path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`https://api.github.com${path}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return await res.json();
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
}

const SRC = /\.(ts|tsx|js|jsx|mjs|cjs|json)$/i;
const SKIP = /(^|\/)(node_modules|dist|build|\.git|\.next)(\/|$)|package-lock\.json|yarn\.lock|pnpm-lock\.yaml/i;

async function main() {
  console.log(`取 ${repo} 的文件树...`);
  const branchInfo = await api(`/repos/${repo}`);
  const tree = await api(`/repos/${repo}/git/trees/${branchInfo.default_branch}?recursive=1`);

  const files = tree.tree.filter(
    (f) => f.type === 'blob' && SRC.test(f.path) && !SKIP.test(f.path) && f.size < 400_000,
  );
  console.log(`源码文件 ${files.length} 个，开始下载...`);

  let done = 0;
  for (const f of files) {
    const target = join(destArg, f.path);
    if (existsSync(target)) continue;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(
          `https://raw.githubusercontent.com/${repo}/${branchInfo.default_branch}/${f.path}`,
          { headers: { 'User-Agent': 'vf-calibration' } },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, Buffer.from(await res.arrayBuffer()));
        done++;
        break;
      } catch (e) {
        if (attempt === 2) console.error(`  ✗ ${f.path}: ${e.message}`);
        else await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }
  console.log(`完成：下载 ${done} 个文件到 ${destArg}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
