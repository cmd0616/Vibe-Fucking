import type { Rule } from '@vibe-fucking/core';
import { codeLines, productionFiles } from './util';

/** L1：词法层 —— 生产代码里残留的 console 调试输出 */
export const noConsoleLeftover: Rule = {
  id: 'no-console-leftover',
  dimension: 'hygiene',
  layer: 1,
  severity: 'warn',
  baseline: 5,
  description: '生产代码中残留的 console 调试输出',
  detect(ctx) {
    const allowInTests = (ctx.config.rules['no-console-leftover']?.options.allowInTests ?? true) as boolean;

    const files = allowInTests ? productionFiles(ctx.files) : ctx.files;

    for (const file of files) {
      codeLines(file.content).forEach((line, idx) => {
        if (!/console\.(log|debug|info)\s*\(/.test(line)) return;

        ctx.report({
          location: { file: file.relativePath, line: idx + 1 },
          snippet: line.trim(),
          reason:
            'AI 习惯用 console 打点验证逻辑，然后忘记清理。它会污染线上日志、可能泄露内部结构，' +
            '更重要的是——这行代码说明它从没被真正审视过。',
          suggestion: {
            summary: '删除调试输出；确需观测时改用项目统一 logger',
            before: line.trim(),
            after: 'logger.debug({ userId }, "user loaded")',
          },
        });
      });
    }
  },
};
