import type { Rule } from '@vibe-fucking/core';
import { isTestFile } from './util';

/** L2：函数过长 —— AI 习惯把整条业务流程塞进一个函数 */
export const noGodFunction: Rule = {
  id: 'no-god-function',
  dimension: 'structure',
  layer: 2,
  severity: 'warn',
  baseline: 2,
  description: '函数过长（一个函数干完整条业务流程）',
  detect(ctx) {
    const maxLines = (ctx.config.rules['no-god-function']?.options.maxLines ?? 80) as number;
    const functions = ctx.ast?.functions() ?? [];

    for (const fn of functions) {
      if (fn.lineCount <= maxLines) continue;
      if (isTestFile(fn.file)) continue;

      ctx.report({
        location: { file: fn.file, line: fn.line },
        snippet: `${fn.name}()  ${fn.line}-${fn.endLine} 行（${fn.lineCount} 行）`,
        reason:
          `函数 ${fn.name}() 长达 ${fn.lineCount} 行，超过阈值 ${maxLines}。` +
          'AI 生成的长函数通常串行做完「校验 → 查询 → 转换 → 落库 → 通知」整条链路，' +
          '任何一环出错都要读完全文才能定位。',
        suggestion: {
          summary: '按业务步骤拆成若干小函数，每个只做一件事',
          before: `function ${fn.name}() { /* ${fn.lineCount} 行 */ }`,
          after: `function ${fn.name}() {\n  const input = validate(...)\n  const data = await load(...)\n  return transform(data)\n}`,
        },
      });
    }
  },
};
