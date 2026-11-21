import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Rule } from '@vibe-fucking/core';

/** L1：未使用依赖 —— AI 推荐装一堆包，最后只用了两个 */
export const noUnusedDeps: Rule = {
  id: 'no-unused-deps',
  dimension: 'engineering',
  layer: 1,
  severity: 'warn',
  baseline: 2,
  description: 'package.json 中声明但从未 import 的依赖',
  detect(ctx) {
    const pkgPath = join(ctx.rootDir, 'package.json');
    if (!existsSync(pkgPath)) return;

    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
    } catch {
      return;
    }

    const deps = Object.keys((pkg.dependencies ?? {}) as Record<string, string>);
    if (deps.length === 0) return;

    const all = ctx.files.map((f) => f.content).join('\n');

    for (const dep of deps) {
      const escaped = dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const used = new RegExp(`from\\s+['"]${escaped}(/[^'"]*)?['"]|require\\(['"]${escaped}`).test(all);
      if (used) continue;

      ctx.report({
        location: { file: 'package.json', line: 1 },
        snippet: `"${dep}" 已声明但从未 import`,
        reason:
          `依赖 ${dep} 写在 package.json 里，但全项目没有任何 import。` +
          'AI 经常一次性推荐安装一整套库，最后只用了其中一两个——剩下的既增加安装体积和构建时间，' +
          '也多出一份供应链攻击面。',
        suggestion: {
          summary: '确认无用后卸载；保留则说明原因',
          before: `"${dep}": "..."`,
          after: `npm uninstall ${dep}`,
        },
      });
    }
  },
};
