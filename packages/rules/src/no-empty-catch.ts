import type { Rule } from '@vibe-fucking/core';
import { isTestFile } from './util';

/** L2：错误处理缺失 —— AI 把 try 写得漂漂亮亮，catch 里却什么都没做 */
export const noEmptyCatch: Rule = {
  id: 'no-empty-catch',
  dimension: 'errorHandling',
  layer: 2,
  severity: 'error',
  baseline: 1,
  description: '空 catch 或只 log 不处理的 catch（错误被静默吞掉）',
  detect(ctx) {
    const catches = ctx.ast?.catches() ?? [];

    for (const item of catches) {
      if (isTestFile(item.file)) continue;
      const isEmpty = item.kind === 'empty';

      ctx.report({
        severity: isEmpty ? 'error' : 'warn',
        location: { file: item.file, line: item.line },
        snippet: item.snippet,
        reason: isEmpty
          ? 'catch 块是空的。请求失败被完全静默吞掉——用户看到的是「没反应」而不是报错，' +
            '排查时连日志都没有。这是 AI 生成代码里最危险的一类屎山。'
          : 'catch 里只打了一行日志，然后继续往下走。错误既没有向上抛出，也没有改变后续流程，' +
            '本质上仍然是吞掉——只是多了点噪音。',
        suggestion: isEmpty
          ? {
              summary: '至少向上抛出或返回 Result；确实无需处理时，写明原因并保留日志',
              before: '} catch (e) {}',
              after: '} catch (e) {\n  throw new AppError("fetchUser failed", { cause: e })\n}',
            }
          : {
              summary: '日志之外必须有动作：向上抛、返回失败态、或走降级分支',
              before: '} catch (e) {\n  console.error(e)\n}',
              after: '} catch (e) {\n  logger.error({ err: e, userId }, "sync failed")\n  return { ok: false, reason: "sync_failed" }\n}',
            },
      });
    }
  },
};
