#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { DIMENSION_LABELS, loadConfig, runScan } from '@vibe-fucking/core';
import type { Rule } from '@vibe-fucking/core';
import { allRules, rulesById } from '@vibe-fucking/rules';
import { createTsAnalyzer } from '@vibe-fucking/analyzer-ts';
import { renderJson, renderTerminal } from '@vibe-fucking/report';

const VERSION = '0.1.0';

interface ParsedArgs {
  command: string;
  positionals: string[];
  flags: Map<string, string[]>;
}

function parseArgv(argv: string[]): ParsedArgs {
  const flags = new Map<string, string[]>();
  const positionals: string[] = [];
  let command = 'scan';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      flags.set('help', ['true']);
    } else if (arg === '-v' || arg === '--version') {
      flags.set('version', ['true']);
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (key.includes('=')) {
        const [k, v] = key.split('=');
        flags.set(k, [...(flags.get(k) ?? []), v]);
      } else if (next && !next.startsWith('-')) {
        flags.set(key, [...(flags.get(key) ?? []), next]);
        i++;
      } else {
        flags.set(key, [...(flags.get(key) ?? []), 'true']);
      }
    } else if (['scan', 'score', 'list-rules', 'explain'].includes(arg) && positionals.length === 0 && i === 0) {
      command = arg;
    } else {
      positionals.push(arg);
    }
  }

  return { command, positionals, flags };
}

function printHelp(): void {
  console.log(`
vf — Vibe-Fucking：Vibecoding 项目的屎山检测器

用法:
  vf scan [路径] [选项]        扫描并输出屎山报告（默认命令）
  vf score [路径]              只输出屎山指数
  vf list-rules                列出全部内置规则
  vf explain <规则ID>          查看单条规则的说明

选项:
  --rule <id>                  只跑指定规则（可重复）
  --format <terminal|json>     输出格式，默认 terminal
  --out <file>                 报告写入文件
  --fail-over <n>              屎山指数超过 n 时退出码 1（CI 门禁）
  --max-issues <n>             详情最多展示条数，默认 10
  --quiet                      只输出分数
  -v, --version                版本
  -h, --help                   帮助

退出码:
  0 = 通过    1 = 超过 --fail-over 阈值    2 = 工具自身错误
`);
}

function printRules(rules: Rule[]): void {
  console.log('\n内置规则:\n');
  console.log('ID                           维度        层   严重度   说明');
  console.log('-'.repeat(96));
  for (const rule of rules) {
    console.log(
      rule.id.padEnd(30) +
        DIMENSION_LABELS[rule.dimension].padEnd(10) +
        `L${rule.layer}   ` +
        rule.severity.padEnd(8) +
        rule.description,
    );
  }
  console.log('');
}

function printExplain(id: string): void {
  const rule = rulesById[id] ?? rulesById[id.replace('vf/', '')];
  if (!rule) {
    console.error(`未找到规则 ${id}\n可用规则：${allRules.map((r) => r.id).join(', ')}`);
    process.exit(2);
  }
  console.log(`
vf/${rule.id}
  维度:     ${DIMENSION_LABELS[rule.dimension]} (${rule.dimension})
  分析层:   L${rule.layer}
  默认级别: ${rule.severity}
  基线:     每千行 ${rule.baseline} 处即视为满分
  说明:     ${rule.description}
`);
}

async function main(): Promise<number> {
  const { command, positionals, flags } = parseArgv(process.argv.slice(2));

  if (flags.has('help')) {
    printHelp();
    return 0;
  }
  if (flags.has('version')) {
    console.log(VERSION);
    return 0;
  }
  if (command === 'list-rules') {
    printRules(allRules);
    return 0;
  }
  if (command === 'explain') {
    printExplain(positionals[0] ?? '');
    return positionals[0] ? 0 : 2;
  }

  const rootDir = positionals[0] ?? '.';
  const only = flags.get('rule');
  const format = flags.get('format')?.[0] ?? 'terminal';
  const outFile = flags.get('out')?.[0];
  const quiet = flags.has('quiet');
  const maxIssues = Number(flags.get('max-issues')?.[0] ?? 10);
  const failOverArg = flags.get('fail-over')?.[0];

  const userConfig = loadConfig(rootDir);
  const needsAnalyzer = allRules.some(
    (r) => r.layer >= 2 && (!only || only.includes(r.id) || only.includes(`vf/${r.id}`)),
  );

  const result = await runScan({
    rootDir,
    rules: allRules,
    only,
    userConfig,
    prepare: ({ rootDir: dir, files }) => {
      if (!needsAnalyzer || files.length === 0) return {};
      return createTsAnalyzer(dir, files);
    },
  });

  const output =
    format === 'json'
      ? renderJson(result)
      : quiet || command === 'score'
        ? `${result.smi}/100  ${result.level.name} — ${result.level.advice}`
        : renderTerminal(result, maxIssues);

  if (outFile) {
    writeFileSync(outFile, output, 'utf8');
    console.log(`报告已写入 ${outFile}`);
  } else {
    console.log(output);
  }

  const failOver = failOverArg ? Number(failOverArg) : userConfig.failOver;
  if (failOver !== undefined && result.smi > failOver) {
    return 1;
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`vf 执行失败: ${(err as Error).message}`);
    process.exit(2);
  });
