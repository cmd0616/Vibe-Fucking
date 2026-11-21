import type { Rule } from '@vibe-fucking/core';

const TODO = /\/\/\s*(TODO|FIXME|HACK|XXX)\b/i;

/** L1：TODO 坟场 —— AI 爱留「// TODO: 添加校验」然后永不实现 */
export const noTodoGraveyard: Rule = {
  id: 'no-todo-graveyard',
  dimension: 'hygiene',
  layer: 1,
  severity: 'info',
  baseline: 3,
  description: 'TODO / FIXME 堆积（AI 留下的未兑现承诺）',
  detect(ctx) {
    for (const file of ctx.files) {
      file.content.split('\n').forEach((line, idx) => {
        if (!TODO.test(line)) return;

        ctx.report({
          location: { file: file.relativePath, line: idx + 1 },
          snippet: line.trim(),
          reason:
            '这是一条 AI 留下的「待办」。它写得像回事，但实际从未实现——' +
            '模型习惯用 TODO 标记自己跳过的部分（校验、错误处理、并发），而 vibecoder 往往根本没读到。',
          suggestion: {
            summary: '要么现在实现，要么变成一张真实的 issue 并从代码里删掉',
            before: line.trim(),
            after: '// 已实现，或移到 issue 追踪系统',
          },
        });
      });
    }
  },
};
