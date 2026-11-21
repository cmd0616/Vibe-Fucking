import type { Rule } from '@vibe-fucking/core';
import { productionFiles } from './util';

/** L1：单文件过长 —— AI 常把整个功能铺在一个文件里 */
export const noGodFile: Rule = {
  id: 'no-god-file',
  dimension: 'structure',
  layer: 1,
  severity: 'warn',
  baseline: 1,
  description: '单文件过长（UI、数据访问、工具函数混在一起）',
  detect(ctx) {
    const maxLines = (ctx.config.rules['no-god-file']?.options.maxLines ?? 600) as number;

    for (const file of productionFiles(ctx.files)) {
      const lines = file.content.split('\n').length;
      if (lines <= maxLines) continue;

      ctx.report({
        location: { file: file.relativePath, line: 1 },
        snippet: `${file.relativePath} 共 ${lines} 行`,
        reason:
          `单文件 ${lines} 行，超过阈值 ${maxLines}。AI 倾向于把整个功能平铺在一个文件里：` +
          '组件、数据访问、工具函数挤在一起，定位一处逻辑要滚半天，且几乎无法被复用。',
        suggestion: {
          summary: '按职责拆分（数据访问 / 业务逻辑 / 表现层各归其位）',
          before: `${file.relativePath}（${lines} 行）`,
          after: '拆成同目录下若干小文件，单文件控制在 300 行以内',
        },
      });
    }
  },
};
