import type { Rule } from '@vibe-fucking/core';
import { codeLines, productionFiles } from './util';

const ANY_IN_TYPE_POSITION = /:\s*any\b|\bas\s+any\b|<any\s*[,\]>]/;

/** L1：any 滥用 —— AI 遇到类型问题时的第一反应是「改成 any」 */
export const noAnySpam: Rule = {
  id: 'no-any-spam',
  dimension: 'typing',
  layer: 1,
  severity: 'warn',
  baseline: 25,
  description: 'any 密度过高（类型系统被整体绕过）',
  detect(ctx) {
    for (const file of productionFiles(ctx.files)) {
      // 先抹掉注释再匹配，否则 JSDoc 里的 any 散文全是噪音
      codeLines(file.content).forEach((line, idx) => {
        if (!ANY_IN_TYPE_POSITION.test(line)) return;

        ctx.report({
          location: { file: file.relativePath, line: idx + 1 },
          snippet: line.trim(),
          reason:
            '这里用 any 绕过了类型检查。AI 遇到类型不匹配时，第一反应往往是标注 any 让报错消失——' +
            '编译确实过了，但这个位置从此失去了所有类型保护，后续重构不会再有任何提示。',
          suggestion: {
            summary: '补出真实类型；确属动态结构时用 unknown + 收窄，而非 any',
            before: line.trim(),
            after: 'const user: User = await getUser(id)   // 或用 unknown 后做类型收窄',
          },
        });
      });
    }
  },
};
