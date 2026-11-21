import type { SourceFile } from '@vibe-fucking/core';

/** 测试文件路径形态：*.test.ts / *.spec.tsx / __tests__/ / tests/ / test-d/（类型测试） */
export const TEST_PATH = /\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)(__tests__|tests?|test-d|specs?)\//;

/**
 * 是否为测试文件。
 * 注意：这里只在**上报**时过滤，分析层仍会看到测试文件——
 * 否则"只在测试里被引用的导出"会被误判为未使用导出。
 */
export function isTestFile(file: string): boolean {
  return TEST_PATH.test(file);
}

export function productionFiles(files: SourceFile[]): SourceFile[] {
  return files.filter((f) => !isTestFile(f.relativePath));
}

/**
 * 把源码里的注释替换成空白，返回与原文**行数一致**的数组。
 *
 * 为什么要这个：L1 规则用正则匹配代码，而 JSDoc 里的英文散文
 * （"such as ..."、"behaves as ..."）会被 `\bas\s+` 之类的正则命中，
 * 在优质项目上制造几十倍误报。必须把注释整块抹掉再匹配。
 *
 * 启发式：不感知字符串内部的 `/*`，极端情况会有残留，但远好于不处理。
 */
export function codeLines(content: string): string[] {
  const result: string[] = [];
  let inBlock = false;

  for (const raw of content.split('\n')) {
    let cur = raw;
    let out = '';

    while (cur.length > 0) {
      if (inBlock) {
        const end = cur.indexOf('*/');
        if (end === -1) {
          cur = '';
          break;
        }
        cur = cur.slice(end + 2);
        inBlock = false;
        continue;
      }

      const blockStart = cur.indexOf('/*');
      const lineStart = cur.indexOf('//');

      if (blockStart !== -1 && (lineStart === -1 || blockStart < lineStart)) {
        out += cur.slice(0, blockStart);
        cur = cur.slice(blockStart + 2);
        inBlock = true;
        continue;
      }

      if (lineStart !== -1) {
        out += cur.slice(0, lineStart);
        break;
      }

      out += cur;
      break;
    }

    result.push(out);
  }

  return result;
}
