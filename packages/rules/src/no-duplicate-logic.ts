import type { Rule } from '@vibe-fucking/core';
import { codeLines, productionFiles } from './util';

/** AI 的重复往往是「函数级复制后小改」，窗口不能太大，否则抓不到 */
const WINDOW = 20;
/** 窗口内至少这么多个标识符/关键字，避免把纯标点序列当成重复 */
const MIN_IDENTIFIERS = 6;
/** 重复块至少跨越这么多行，避免把一行 boilerplate 当重复 */
const MIN_LINES = 3;

interface Token {
  text: string;
  file: string;
  line: number;
}

interface DupRange {
  file: string;
  start: number;
  end: number;
  origin: string;
}

function splitTokens(line: string): string[] {
  return line
    .replace(/'[^']*'|"[^"]*"|`[^`]*`/g, 'S')
    .replace(/([{}()[\];,.<>=+\-*/!?:&|])/g, ' $1 ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * L2：近似重复逻辑 —— AI 没有项目级记忆，同一个逻辑会被重新生成若干次，
 * 每次都略有不同（超时值、重试次数、错误处理各写各的）。
 */
export const noDuplicateLogic: Rule = {
  id: 'no-duplicate-logic',
  dimension: 'structure',
  layer: 2,
  severity: 'warn',
  baseline: 8,
  description: '被复制粘贴/重新生成多次的近似重复逻辑',
  detect(ctx) {
    const all: Token[] = [];
    for (const file of productionFiles(ctx.files)) {
      const lines = codeLines(file.content);
      for (let i = 0; i < lines.length; i++) {
        for (const token of splitTokens(lines[i])) {
          all.push({ text: token, file: file.relativePath, line: i + 1 });
        }
      }
    }

    const buckets = new Map<string, { file: string; start: number; end: number }[]>();
    for (let i = 0; i + WINDOW <= all.length; i++) {
      const slice = all.slice(i, i + WINDOW);
      if (slice[0].file !== slice[WINDOW - 1].file) continue;
      if (slice[WINDOW - 1].line - slice[0].line + 1 < MIN_LINES) continue;
      if (slice.filter((t) => /^[A-Za-z_$][\w$]*$/.test(t.text)).length < MIN_IDENTIFIERS) continue;

      const key = slice.map((t) => t.text).join(' ');
      const rec = { file: slice[0].file, start: slice[0].line, end: slice[WINDOW - 1].line };
      const bucket = buckets.get(key);
      if (bucket) bucket.push(rec);
      else buckets.set(key, [rec]);
    }

    // 只收集「复制品」（第 2 处及以后），第一处视为原本
    const ranges: DupRange[] = [];
    for (const occurrences of buckets.values()) {
      if (occurrences.length < 2) continue;
      const origin = `${occurrences[0].file}:${occurrences[0].start}`;
      for (const rec of occurrences.slice(1)) {
        ranges.push({ ...rec, origin });
      }
    }

    // 同一段重复会产生大量重叠窗口，必须按文件合并成连续区间，否则一处重复报 N 条
    const byFile = new Map<string, DupRange[]>();
    for (const range of ranges) {
      const list = byFile.get(range.file);
      if (list) list.push(range);
      else byFile.set(range.file, [range]);
    }

    for (const list of byFile.values()) {
      list.sort((a, b) => a.start - b.start);

      const merged: DupRange[] = [];
      for (const range of list) {
        const last = merged[merged.length - 1];
        if (last && range.start <= last.end + 1) {
          last.end = Math.max(last.end, range.end);
        } else {
          merged.push({ ...range });
        }
      }

      for (const region of merged) {
        ctx.report({
          location: { file: region.file, line: region.start, endLine: region.end },
          snippet: `${region.file}:${region.start}-${region.end}`,
          reason:
            `这段逻辑（${region.end - region.start + 1} 行）与 ${region.origin} 高度相似。` +
            'AI 每次生成都是「重新想一遍」，于是同一件事被写了好几份，' +
            '超时、重试、错误处理各自为政——改一处漏一处，而且漏的地方往往不知道。',
          suggestion: {
            summary: '抽取成共享函数，让所有调用点复用同一份实现',
            before: '// 多处各写各的实现',
            after: '// 抽到 shared/ 下，调用方统一 import',
          },
        });
      }
    }
  },
};
