import type { Rule } from '@vibe-fucking/core';
import { isTestFile } from './util';

/** L3：未使用导出 —— AI 默认 export 一切，留下大量无人调用的死接口 */
export const noUnusedExport: Rule = {
  id: 'no-unused-export',
  dimension: 'abstraction',
  layer: 3,
  severity: 'warn',
  baseline: 6,
  description: '全项目无人引用的导出（AI 默认 export 一切）',
  detect(ctx) {
    const unused = ctx.symbols?.unusedExports() ?? [];

    for (const sym of unused) {
      // 分析层仍统计测试引用（否则"仅被测试引用"会被误判），这里只跳过测试文件自身的导出
      if (isTestFile(sym.file)) continue;
      ctx.report({
        location: { file: sym.file, line: sym.line },
        snippet: `export ... ${sym.name}`,
        reason:
          `${sym.name} 被导出，但全项目没有第二个引用点。AI 出于「万一要用」的心理默认导出一切，` +
          '结果这些符号永远不会被删除，也永远不会被维护——它们只会腐烂。',
        suggestion: {
          summary: '改为模块内部符号（去掉 export）；确认无用则直接删除',
          before: `export function ${sym.name}() { ... }`,
          after: `function ${sym.name}() { ... }  // 无人使用，先不导出`,
        },
      });
    }
  },
};
