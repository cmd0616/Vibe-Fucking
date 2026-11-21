import type { Rule } from '@vibe-fucking/core';
import { isTestFile, productionFiles } from './util';

interface CommentBlock {
  startLine: number;
  endLine: number;
  lines: string[];
  kind: 'block' | 'line';
}

/**
 * 提取源码里的注释块。
 *
 * 关键：**跳过 JSDoc（/** ... *\/）** —— 那里面出现 `const`/`return` 是文档示例，
 * 不是被注释掉的代码。之前多条规则已经因为没剥 JSDoc 在优质库上炸出几百条误报。
 */
function commentBlocks(content: string): CommentBlock[] {
  const raw = content.split('\n');
  const blocks: CommentBlock[] = [];
  let i = 0;

  while (i < raw.length) {
    const trimmed = raw[i].trim();

    // JSDoc：整块跳过（含单行 /** ... */）
    if (trimmed.startsWith('/**')) {
      if (!trimmed.includes('*/')) {
        while (i < raw.length && !raw[i].includes('*/')) i++;
      }
      i++;
      continue;
    }

    // 块注释 /* ... */
    if (trimmed.startsWith('/*')) {
      const startLine = i + 1;
      const body: string[] = [];
      let first = trimmed.slice(2);
      if (first.includes('*/')) {
        first = first.slice(0, first.indexOf('*/'));
        if (first.trim()) body.push(first.trim());
        i++;
      } else {
        if (first.trim()) body.push(stripStar(first));
        i++;
        while (i < raw.length && !raw[i].includes('*/')) {
          body.push(stripStar(raw[i].trim()));
          i++;
        }
        if (i < raw.length) {
          const tail = raw[i].slice(0, raw[i].indexOf('*/')).trim();
          if (tail) body.push(tail);
          i++;
        }
      }
      blocks.push({ startLine, endLine: i, lines: body, kind: 'block' });
      continue;
    }

    // 连续行注释 // ...
    if (trimmed.startsWith('//')) {
      const startLine = i + 1;
      const body: string[] = [];
      while (i < raw.length && raw[i].trim().startsWith('//')) {
        body.push(raw[i].trim().slice(2).trim());
        i++;
      }
      blocks.push({ startLine, endLine: i, lines: body, kind: 'line' });
      continue;
    }

    i++;
  }

  return blocks;
}

function stripStar(line: string): string {
  return line.replace(/^\*\s?/, '').trim();
}

/** 代码特征：关键字开头，或语句结构（分号/花括号/赋值/箭头） */
const CODE_START =
  /^(?:const|let|var|function|return|if|for|while|import|export|class|await|async|throw|try|catch|switch|case|else|do|new|yield|interface|type|enum|from|extend|implements)\b/;
const CODE_SHAPE = /(?:[;{}]\s*$|\([^)]*\)\s*\{|=\s*[^=>]|=>|\$\{)/;

function looksLikeCode(line: string): boolean {
  return !!line && (CODE_START.test(line) || CODE_SHAPE.test(line));
}

/**
 * L1：注释掉的代码 —— 63% 的 vibe-coded 仓库含有注释掉的大段代码。
 * AI 在改主意时不删旧实现，而是注释掉"留着以后用"，于是代码里躺着一具具僵尸。
 */
export const noCommentedOutCode: Rule = {
  id: 'no-commented-out-code',
  dimension: 'hygiene',
  layer: 1,
  severity: 'info',
  baseline: 2,
  description: '大段被注释掉的代码（"留着以后用"的僵尸实现）',
  detect(ctx) {
    const minLines = (ctx.config.rules['no-commented-out-code']?.options.minLines ?? 3) as number;
    const ratio = (ctx.config.rules['no-commented-out-code']?.options.codeRatio ?? 0.5) as number;

    for (const file of productionFiles(ctx.files)) {
      for (const block of commentBlocks(file.content)) {
        const meaningful = block.lines.filter(Boolean);
        if (meaningful.length < minLines) continue;

        const codeLinesCount = meaningful.filter(looksLikeCode).length;
        if (codeLinesCount < Math.max(2, Math.ceil(meaningful.length * ratio))) continue;

        const sample = meaningful.filter(looksLikeCode)[0];
        ctx.report({
          location: {
            file: file.relativePath,
            line: block.startLine,
            endLine: block.endLine,
          },
          snippet: `${meaningful.length} 行注释，其中 ${codeLinesCount} 行像代码：${sample}`,
          reason:
            `这里有 ${meaningful.length} 行被注释掉的代码。AI 改主意时习惯把旧实现注释掉` +
            '而不是删除，理由是"可能以后要用"——但它们永远不会被恢复，只会让下一个人' +
            '困惑哪份才是真的实现。版本控制存在的意义就是让你不需要这么做。',
          suggestion: {
            summary: '直接删掉；真需要旧实现就从 git 历史里找',
            before: sample,
            after: '// 已删除 —— 需要时查 git log',
          },
        });
      }
    }
  },
};
