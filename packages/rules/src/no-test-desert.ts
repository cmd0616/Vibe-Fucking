import type { Rule } from '@vibe-fucking/core';

const TEST_PATH = /\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)(__tests__|tests?)\//;

/** L1：测试真空 —— 项目级判定，只看有没有测试文件 */
export const noTestDesert: Rule = {
  id: 'no-test-desert',
  dimension: 'engineering',
  layer: 1,
  severity: 'error',
  /** 项目级二值判定：有这条问题即该规则满分 */
  baseline: 0,
  description: '项目缺少测试（AI 几乎不会主动写测试）',
  detect(ctx) {
    if (ctx.files.length === 0) return;

    const testFiles = ctx.files.filter((f) => TEST_PATH.test(f.relativePath)).length;
    const minRatio = (ctx.config.rules['no-test-desert']?.options.minRatio ?? 0.1) as number;
    const ratio = testFiles / ctx.files.length;

    if (testFiles === 0) {
      ctx.report({
        location: { file: '.', line: 1 },
        snippet: `测试文件 0 / 源文件 ${ctx.files.length}`,
        reason:
          '整个项目没有一个测试文件。AI 只在被明确要求时才写测试，而 vibecoding 的流程天然不提这个要求——' +
          '结果是没有人会去验证边界条件，唯一的质量保证是「跑起来没报错」。',
        suggestion: {
          summary: '先补关键路径的集成测试（在 API 边界测行为，别测内部实现）',
          before: '（无测试）',
          after: 'src/__tests__/userService.test.ts —— 覆盖正常路径 + 网络失败 + 空数据',
        },
      });
      return;
    }

    if (ratio < minRatio) {
      ctx.report({
        severity: 'warn',
        location: { file: '.', line: 1 },
        snippet: `测试文件 ${testFiles} / 源文件 ${ctx.files.length}（${(ratio * 100).toFixed(0)}%）`,
        reason:
          `测试文件占比 ${(ratio * 100).toFixed(0)}%，低于阈值 ${(minRatio * 100).toFixed(0)}%。` +
          '少量测试通常只覆盖 happy path，而 AI 代码恰恰在边界条件上最容易出事。',
        suggestion: {
          summary: '把测试补到关键路径上，优先覆盖失败模式（超时、脏数据、并发）',
          before: `${testFiles} 个测试文件`,
          after: '覆盖每个 service 的失败分支，而非只测正常返回',
        },
      });
    }
  },
};
