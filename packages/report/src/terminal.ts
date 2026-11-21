import { DIMENSION_LABELS } from '@vibe-fucking/core';
import type { Issue, ScanResult } from '@vibe-fucking/core';

const C = {
  reset: '[0m',
  dim: '[2m',
  bold: '[1m',
  red: '[31m',
  yellow: '[33m',
  green: '[32m',
  cyan: '[36m',
};

const SEVERITY_LABEL: Record<Issue['severity'], string> = {
  error: '严重',
  warn: '警告',
  info: '提示',
};

const SEVERITY_COLOR: Record<Issue['severity'], string> = {
  error: C.red,
  warn: C.yellow,
  info: C.cyan,
};

function bar(score: number, width = 10): string {
  const filled = Math.round((Math.min(100, Math.max(0, score)) / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function cjkWidth(s: string): number {
  return [...s].reduce((w, ch) => w + (/[一-鿿　-〿＀-￯]/.test(ch) ? 2 : 1), 0);
}

const padEnd = (s: string, n: number): string => s + ' '.repeat(Math.max(0, n - cjkWidth(s)));

export function renderTerminal(result: ScanResult, maxIssues = 10): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`${C.bold}🔍 Vibe-Fucking v0.1.0${C.reset}`);
  lines.push('');
  lines.push(
    `项目: ${C.bold}${result.rootDir.split(/[\\/]/).pop()}${C.reset}` +
      `    文件: ${result.fileCount}    代码行: ${result.codeLines}`,
  );
  lines.push('');

  const color = result.smi > 80 ? C.red : result.smi > 60 ? C.yellow : result.smi > 40 ? C.yellow : C.green;
  lines.push(
    `${C.bold}屎山指数: ${color}${result.smi}/100${C.reset}` +
      `   ${result.level.name} — ${result.level.advice}`,
  );
  lines.push('');

  for (const d of result.dimensions) {
    const label = DIMENSION_LABELS[d.dimension];
    lines.push(
      `${padEnd(label, 10)}${String(d.score).padStart(3)}  ${bar(d.score)}  ${C.dim}${d.issues} 处${C.reset}`,
    );
  }

  if (result.codeLines < 500) {
    lines.push(
      `${C.dim}⚠️  代码量仅 ${result.codeLines} 行，密度类指标波动大，指数仅供参考${C.reset}`,
    );
  }

  const shown = result.issues.slice(0, maxIssues);
  lines.push('');
  lines.push(
    `${C.bold}共发现 ${result.issues.length} 处问题${C.reset}` +
      (result.issues.length > shown.length ? `（展示前 ${shown.length} 条）` : '') +
      ':',
  );

  for (const issue of shown) {
    const color2 = SEVERITY_COLOR[issue.severity];
    lines.push('');
    lines.push(
      `${color2}[vf/${issue.ruleId}]${C.reset} ${SEVERITY_LABEL[issue.severity]} · ` +
        `${issue.location.file}:${issue.location.line}`,
    );
    lines.push(` 屎山成因: ${issue.reason}`);
    lines.push(` 修正建议: ${issue.suggestion.summary}`);
    if (issue.suggestion.before) lines.push(`   ${C.red}- ${issue.suggestion.before}${C.reset}`);
    if (issue.suggestion.after) lines.push(`   ${C.green}+ ${issue.suggestion.after}${C.reset}`);
  }

  lines.push('');
  return lines.join('\n');
}
