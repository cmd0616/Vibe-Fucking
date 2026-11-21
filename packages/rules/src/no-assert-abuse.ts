import type { Rule } from '@vibe-fucking/core';
import { codeLines, productionFiles } from './util';

/** as const 是合理的字面量收窄，不算断言滥用 */
const ASSERTION = /\bas\s+(?!const\b)[A-Za-z_$]/;

/** L1：类型断言滥用 —— AI 用 as 强行让类型检查闭嘴 */
export const noAssertAbuse: Rule = {
  id: 'no-assert-abuse',
  dimension: 'typing',
  layer: 1,
  severity: 'warn',
  baseline: 15,
  description: 'as 类型断言密度过高（强行让编译器闭嘴）',
  detect(ctx) {
    for (const file of productionFiles(ctx.files)) {
      // 必须剥掉 JSDoc：英文散文里的 "as well as" 会被当成类型断言
      codeLines(file.content).forEach((line, idx) => {
        if (!ASSERTION.test(line)) return;

        ctx.report({
          location: { file: file.relativePath, line: idx + 1 },
          snippet: line.trim(),
          reason:
            '这里用 as 断言强行改写了类型。断言只是告诉编译器「别管」，运行时不会做任何校验——' +
            '一旦上游结构变了，这里就是静默的错误数据。AI 常在拿不到正确类型时批量加 as。',
          suggestion: {
            summary: '让类型自然推导；跨边界数据先做校验（zod / 类型守卫）再使用',
            before: line.trim(),
            after: 'const user = UserSchema.parse(raw)   // 真校验，而不是断言',
          },
        });
      });
    }
  },
};
