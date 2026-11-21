import type { Rule } from '@vibe-fucking/core';
import { isTestFile } from './util';

/** L2：缺失 await —— 拿到的是 Promise 却当值用，AI 高频异步 bug */
export const noMissingAwait: Rule = {
  id: 'no-missing-await',
  dimension: 'errorHandling',
  layer: 2,
  severity: 'error',
  baseline: 1,
  description: '调用了 async 函数却没 await，把 Promise 当成值使用',
  detect(ctx) {
    const issues = ctx.ast?.asyncCallIssues() ?? [];

    for (const issue of issues) {
      if (issue.kind !== 'missing-await') continue;
      if (isTestFile(issue.file)) continue;

      ctx.report({
        location: { file: issue.file, line: issue.line },
        snippet: issue.snippet,
        reason:
          `${issue.callee}() 是 async 函数，返回值是 Promise，但这里没有 await 就直接用了。` +
          '后续代码拿到的是 Promise 实例而非真实数据——判断永远为真、字段永远是 undefined，' +
          '而且报错发生在很远的地方。这是 AI 写异步代码最常见的 bug。',
        suggestion: {
          summary: '补上 await（调用方需为 async），或显式 .then() 处理',
          before: issue.snippet,
          after: `await ${issue.snippet}`,
        },
      });
    }
  },
};
