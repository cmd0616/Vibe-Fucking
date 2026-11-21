import type { Rule } from '@vibe-fucking/core';
import { isTestFile } from './util';

/**
 * L2/L3：死代码 —— AI 留下的"备用实现"与写了一半的分支。
 *
 * 两类：
 * - return/throw 之后永远不会执行的语句（说明逻辑被改过但残骸没删）
 * - 声明后再没被读取的局部变量（AI 常先声明后改主意）
 */
export const noDeadCode: Rule = {
  id: 'no-dead-code',
  dimension: 'hygiene',
  layer: 2,
  severity: 'warn',
  baseline: 2,
  description: '不可达代码与未使用的局部变量（AI 留下的残骸）',
  detect(ctx) {
    const issues = ctx.ast?.deadCode() ?? [];

    for (const item of issues) {
      if (isTestFile(item.file)) continue;
      const unreachable = item.kind === 'unreachable';

      ctx.report({
        location: { file: item.file, line: item.line },
        snippet: item.snippet,
        reason: unreachable
          ? '这行代码位于 return/throw 之后，永远不会执行。它通常意味着 AI 改写逻辑时' +
            '留下了旧实现的残骸——读者会误以为它还在生效，维护时甚至会照着它改。'
          : `局部变量 ${item.name} 声明后再没有被读取。AI 在试探性写法里常先声明变量、` +
            '随后改用另一种实现，却没有清理声明——这是它"边写边想"留下的脚印。',
        suggestion: unreachable
          ? {
              summary: '直接删除不可达语句；若本意是执行它，检查上面的提前返回条件',
              before: `return ...\n${item.snippet}`,
              after: 'return ...   // 之后的残骸已删除',
            }
          : {
              summary: '删除未使用的局部变量；若本意是保留副作用，改成直接调用',
              before: item.snippet,
              after: '// 已删除（无读取点）',
            },
      });
    }
  },
};
