import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { get } from 'node:https';
import type { Rule } from '@vibe-fucking/core';
import { codeLines } from './util';

const NODE_BUILTINS = new Set([
  'assert', 'buffer', 'child_process', 'cluster', 'console', 'constants', 'crypto', 'dgram',
  'dns', 'events', 'fs', 'http', 'http2', 'https', 'inspector', 'module', 'net', 'os', 'path',
  'perf_hooks', 'process', 'punycode', 'querystring', 'readline', 'stream', 'string_decoder',
  'timers', 'tls', 'tty', 'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib',
]);

function packageNameOf(specifier: string): string | null {
  if (specifier.startsWith('node:') || specifier.startsWith('.')) return null;

  // 项目内路径别名：@/app、~/components、#/types —— 不是外部依赖
  if (/^[@~#]\//.test(specifier)) return null;

  const parts = specifier.split('/');
  // @scope/pkg 是合法包名；单独的 @scope 或 @foo 多半是别名/占位符
  if (specifier.startsWith('@')) {
    return parts.length >= 2 && parts[1] ? `${parts[0]}/${parts[1]}` : null;
  }
  return parts[0];
}

function declaredDeps(rootDir: string): Set<string> {
  const pkgPath = join(rootDir, 'package.json');
  if (!existsSync(pkgPath)) return new Set();
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
    return new Set([
      ...Object.keys((pkg.dependencies ?? {}) as Record<string, string>),
      ...Object.keys((pkg.devDependencies ?? {}) as Record<string, string>),
    ]);
  } catch {
    return new Set();
  }
}

/** 可选：查 npm registry 确认包是否真实存在（需要网络，默认关闭） */
function existsInRegistry(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
    const req = get(url, (res) => {
      resolve(res.statusCode === 200);
      res.resume();
    });
    req.on('error', () => resolve(true)); // 网络异常时不误报
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(true);
    });
  });
}

/**
 * L1/L2：幻觉依赖 —— AI 编造的包名（slopsquatting 风险：
 * 模型编出的包名被攻击者抢注后，一次 npm install 就是一次远程代码执行）
 */
export const noHallucinatedImport: Rule = {
  id: 'no-hallucinated-import',
  dimension: 'engineering',
  layer: 1,
  severity: 'error',
  baseline: 3,
  description: '导入了未声明/不存在/未安装的第三方包（AI 幻觉依赖）',
  async detect(ctx) {
    const deps = declaredDeps(ctx.rootDir);
    const checkRegistry = (ctx.config.rules['no-hallucinated-import']?.options.checkRegistry ?? false) as boolean;
    // 项目压根没装依赖时，「声明了但未安装」是无意义的噪音，跳过这一类
    const depsInstalled = existsSync(join(ctx.rootDir, 'node_modules'));

    const seen = new Set<string>();

    for (const file of ctx.files) {
      const specifiers: string[] = [];
      // 必须逐行扫剥离注释后的代码：JSDoc @example 里的 `import ky from 'ky'` 会造成假报。
      // 同时必须**锚定到行首**：早期用未锚定的 /from|import/ 会匹配到字符串字面量内部
      // （实测把 `${'é 🌍'}` 当成包名），锚定后这类噪音消失。
      for (const line of codeLines(file.content)) {
        const staticImport = /^\s*(?:import|export)\b.*?from\s*['"]([^'"]+)['"]/.exec(line);
        if (staticImport) specifiers.push(staticImport[1]);

        const bareImport = /^\s*import\s*['"]([^'"]+)['"]/.exec(line);
        if (bareImport) specifiers.push(bareImport[1]);

        const dynamicImport = /\bimport\s*\(\s*['"]([^'"]+)['"]/.exec(line);
        if (dynamicImport) specifiers.push(dynamicImport[1]);

        const required = /\brequire\s*\(\s*['"]([^'"]+)['"]/.exec(line);
        if (required) specifiers.push(required[1]);
      }

      for (const specifier of specifiers) {
        const pkg = packageNameOf(specifier);
        if (!pkg || NODE_BUILTINS.has(pkg) || seen.has(pkg)) continue;

        const installed = existsSync(join(ctx.rootDir, 'node_modules', pkg));
        const declared = deps.has(pkg);

        let reason = '';
        let severity: 'error' | 'info' = 'error';

        if (!declared && !installed) {
          reason =
            `导入了 ${pkg}，但它既不在 package.json 里，也没安装在 node_modules 里。` +
            'AI 经常凭印象拼出包名（尤其带 @scope 的那种）。这类幻觉包名常被攻击者抢注，' +
            '一旦有人顺手 npm install，就是一次供应链攻击。';
        } else if (declared && !installed && depsInstalled) {
          severity = 'info';
          reason =
            `${pkg} 声明在 package.json 中，但 node_modules 里找不到。` +
            '可能是 AI 编造的包名（install 时会直接失败），也可能是依赖没装全。';
        } else {
          seen.add(pkg);
          continue;
        }

        if (checkRegistry && !(await existsInRegistry(pkg))) {
          reason += ' （已查询 npm registry：该包不存在）';
        }

        const line = file.content.split('\n').findIndex((l) => l.includes(specifier)) + 1;

        ctx.report({
          location: { file: file.relativePath, line: Math.max(1, line) },
          snippet: `import ... from '${specifier}'`,
          severity,
          reason,
          suggestion: {
            summary: `确认包是否存在：npm view ${pkg}；不存在则改回手写实现或换成真实存在的包`,
            before: `import ... from '${specifier}'`,
            after: `// npm view ${pkg} version  // 先确认存在再装`,
          },
        });

        seen.add(pkg);
      }
    }
  },
};
