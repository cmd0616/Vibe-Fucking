import type { Rule } from '@vibe-fucking/core';
import { isTestFile } from './util';

/** L2：语法树层 —— 函数体只有一行 return 调用的纯转发包装 */
export const noPureForwarder: Rule = {
  id: 'no-pure-forwarder',
  dimension: 'abstraction',
  layer: 2,
  severity: 'warn',
  baseline: 6,
  description: '函数体只有一行 return 调用的纯转发包装（零增益抽象）',
  detect(ctx) {
    const forwarders = ctx.ast?.pureForwarders() ?? [];

    for (const fn of forwarders) {
      // 测试里的 setup 薄包裹不算抽象屎山
      if (isTestFile(fn.file)) continue;

      ctx.report({
        location: { file: fn.file, line: fn.line },
        snippet: fn.snippet,
        reason:
          `函数 ${fn.name}() 只是把调用转发给另一个函数，没有增加任何逻辑。` +
          'AI 倾向于给每层调用都套一个同名包装，结果是调用链变长、跳转变多，但没有任何收益。',
        suggestion: {
          summary: '直接暴露被包装的函数；若确实需要稳定入口，请在文档里说明它为何存在',
          before: fn.snippet,
          after: '// 删除该包装，调用方直接使用被转发的目标函数',
        },
      });
    }
  },
};
