import type { Rule } from '@vibe-fucking/core';
import { isTestFile } from './util';

/** L2：嵌套过深 —— AI 很少用提前返回，只会一层层往里套 */
export const noDeepNesting: Rule = {
  id: 'no-deep-nesting',
  dimension: 'structure',
  layer: 2,
  severity: 'warn',
  baseline: 3,
  description: '控制流嵌套过深（AI 不爱提前返回）',
  detect(ctx) {
    const maxDepth = (ctx.config.rules['no-deep-nesting']?.options.maxDepth ?? 4) as number;
    const functions = ctx.ast?.functions() ?? [];

    for (const fn of functions) {
      if (fn.maxNesting <= maxDepth) continue;
      if (isTestFile(fn.file)) continue;

      ctx.report({
        location: { file: fn.file, line: fn.line },
        snippet: `${fn.name}()  最大嵌套 ${fn.maxNesting} 层`,
        reason:
          `函数 ${fn.name}() 的控制流嵌套达 ${fn.maxNesting} 层，超过阈值 ${maxDepth}。` +
          'AI 几乎不会写提前返回（guard clause），只会 if 套 for 再套 if，' +
          '读者必须在大脑里维护一整条条件栈才能看懂else分支属于谁。',
        suggestion: {
          summary: '用提前返回拍平嵌套：先处理异常/边界并 return，主干逻辑保持一层',
          before: 'if (a) {\n  if (b) {\n    if (c) { /* 业务逻辑 */ }\n  }\n}',
          after: 'if (!a) return\nif (!b) return\nif (!c) return\n/* 业务逻辑 */',
        },
      });
    }
  },
};
