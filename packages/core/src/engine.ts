import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, extname, resolve } from 'node:path';
import type {
  Config,
  Issue,
  ResolvedConfig,
  Rule,
  RuleIssueInput,
  ScanContext,
  ScanResult,
  SourceFile,
} from './types';
import { globToRegExp, loadConfig, resolveConfig } from './config';
import { computeScores, levelOf } from './scoring';

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);
const ALWAYS_SKIP = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.turbo', 'out', 'vendor',
]);

export interface ScanOptions {
  rootDir: string;
  rules: Rule[];
  userConfig?: Config;
  /** 只跑指定规则（对应 CLI --rule） */
  only?: string[];
  /** 由 analyzer 注入 L2/L3 能力，避免 core 反向依赖 analyzer */
  prepare?: (base: {
    rootDir: string;
    files: SourceFile[];
    config: ResolvedConfig;
  }) => Partial<ScanContext> | Promise<Partial<ScanContext>>;
}

function walk(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ALWAYS_SKIP.has(entry.name)) continue;
      walk(full, out);
    } else if (SOURCE_EXTS.has(extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

export function collectFiles(rootDir: string, ignore: string[]): SourceFile[] {
  const patterns = ignore.map(globToRegExp);
  return walk(rootDir)
    .map((path) => ({
      path,
      relativePath: relative(rootDir, path).replace(/\\/g, '/'),
      content: '',
    }))
    .filter((f) => !patterns.some((re) => re.test(f.relativePath)))
    .map((f) => ({ ...f, content: readFileSync(f.path, 'utf8') }));
}

export function countCodeLines(files: SourceFile[]): number {
  return files.reduce(
    (n, f) => n + f.content.split('\n').filter((l) => l.trim() && !/^\s*(\/\/|\*|\/\*)/.test(l)).length,
    0,
  );
}

export async function runScan(options: ScanOptions): Promise<ScanResult> {
  const rootDir = resolve(options.rootDir);
  const userConfig = options.userConfig ?? loadConfig(rootDir);

  const allRules = options.only?.length
    ? options.rules.filter((r) => options.only!.includes(r.id) || options.only!.includes(r.id.replace('vf/', '')))
    : options.rules;

  const config = resolveConfig(userConfig, allRules);
  const activeRules = allRules.filter((r) => config.rules[r.id]?.enabled !== false);

  const files = collectFiles(rootDir, config.ignore);
  const codeLines = countCodeLines(files);

  const issues: Issue[] = [];
  let currentRule: Rule | null = null;

  const report = (input: RuleIssueInput): void => {
    if (!currentRule) return;
    issues.push({
      ruleId: currentRule.id,
      severity: input.severity ?? config.rules[currentRule.id]?.severity ?? currentRule.severity,
      location: input.location,
      snippet: input.snippet,
      reason: input.reason,
      suggestion: input.suggestion,
    });
  };

  const base = { rootDir, files, config };
  const extra = (await options.prepare?.(base)) ?? {};

  const ctx: ScanContext = { ...base, ...extra, report };

  for (const rule of activeRules) {
    currentRule = rule;
    await rule.detect(ctx);
  }
  currentRule = null;

  const { smi, dimensions } = computeScores(issues, codeLines, activeRules, config);

  issues.sort((a, b) => {
    const rank = { error: 0, warn: 1, info: 2 } as const;
    return rank[a.severity] - rank[b.severity] || a.location.file.localeCompare(b.location.file);
  });

  return {
    rootDir,
    fileCount: files.length,
    codeLines,
    issues,
    dimensions,
    smi,
    level: levelOf(smi),
  };
}
