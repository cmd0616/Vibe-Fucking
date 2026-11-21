import type { Rule } from '@vibe-fucking/core';

/** L3：类型与跨文件符号层 —— 只有一个实现的仪式性接口 */
export const noSingleImplInterface: Rule = {
  id: 'no-single-impl-interface',
  dimension: 'abstraction',
  layer: 3,
  severity: 'error',
  baseline: 4,
  description: '只有一个实现的 interface（AI 的「面向接口编程」仪式）',
  detect(ctx) {
    const interfaces = ctx.symbols?.interfaceImplementations() ?? [];

    for (const itf of interfaces) {
      if (itf.implCount !== 1) continue;

      ctx.report({
        location: { file: itf.file, line: itf.line },
        snippet: `interface ${itf.name}`,
        reason:
          `interface ${itf.name} 全项目只有一个实现。这是 AI 的仪式性抽象——` +
          '它把「面向接口编程」当成默认动作，结果每次改签名都要动两个文件，却换不来任何多态收益。',
        suggestion: {
          summary: '删除接口直接用类；等真的出现第二种实现时再抽取不迟',
          before: `interface ${itf.name} { ... }\nclass X implements ${itf.name} { ... }`,
          after: `class X { ... }  // 需要多态时再由调用方定义接口`,
        },
      });
    }
  },
};
