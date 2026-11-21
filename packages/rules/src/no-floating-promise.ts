import type { Rule } from '@vibe-fucking/core';
import { isTestFile } from './util';

/** L2：浮动 Promise —— 异步调用被当成「发射后不管」，失败无人知晓 */
export const noFloatingPromise: Rule = {
  id: 'no-floating-promise',
  dimension: 'errorHandling',
  layer: 2,
  severity: 'warn',
  baseline: 1,
  description: 'async 调用被丢弃（既不 await 也不 catch）',
  detect(ctx) {
    const issues = ctx.ast?.asyncCallIssues() ?? [];

    for (const issue of issues) {
      if (issue.kind !== 'floating') continue;
      // 测试里 fire-and-forget 是常态（起 setup/teardown），不算生产屎山
      if (isTestFile(issue.file)) continue;

      ctx.report({
        location: { file: issue.file, line: issue.line },
        snippet: issue.snippet,
        reason:
          `${issue.callee}() 是 async 函数，但整个调用被当作普通语句丢掉了：` +
          '既不 await 也不 .catch()。它的失败会变成一个 unhandled rejection——' +
          '在本地可能看不出来，上线后就是静默丢失的任务。',
        suggestion: {
          summary: '需要等待就 await；确实要并发就用 Promise.all 并统一 catch',
          before: `${issue.snippet};`,
          after: `await ${issue.snippet};   // 或 void ${issue.snippet}.catch(logError)`,
        },
      });
    }
  },
};
