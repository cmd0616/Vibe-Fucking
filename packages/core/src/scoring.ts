import type { Dimension, DimensionScore, Issue, Level, ResolvedConfig, Rule } from './types';
import { DEFAULT_DIMENSION_WEIGHTS } from './config';

export const DIMENSIONS: Dimension[] = [
  'structure',
  'abstraction',
  'errorHandling',
  'typing',
  'hygiene',
  'engineering',
];

/**
 * 计分：
 * 1. 每条规则按密度（每千行问题数）归一化成 0-100 的规则分 —— 达到 baseline 即满分
 * 2. 维度分 = 该维度内所有规则分的算术平均
 * 3. SMI = 各维度分按权重加权求和（0-100，越高越屎）
 */
export function computeScores(
  issues: Issue[],
  codeLines: number,
  rules: Rule[],
  config: ResolvedConfig,
): { smi: number; dimensions: DimensionScore[] } {
  const kloc = Math.max(codeLines, 1) / 1000;

  const counts = new Map<string, number>();
  for (const issue of issues) {
    counts.set(issue.ruleId, (counts.get(issue.ruleId) ?? 0) + 1);
  }

  const ruleScores = new Map<string, number>();
  for (const rule of rules) {
    const baseline = config.rules[rule.id]?.baseline ?? rule.baseline;
    const density = (counts.get(rule.id) ?? 0) / kloc;
    const score = baseline > 0 ? Math.min(100, (density / baseline) * 100) : density > 0 ? 100 : 0;
    ruleScores.set(rule.id, score);
  }

  const dimensions: DimensionScore[] = DIMENSIONS.map((dimension) => {
    const dimRules = rules.filter((r) => r.dimension === dimension);
    const dimIssues = issues.filter((i) => dimRules.some((r) => r.id === i.ruleId)).length;
    const score = dimRules.length
      ? dimRules.reduce((sum, r) => sum + (ruleScores.get(r.id) ?? 0), 0) / dimRules.length
      : 0;
    return {
      dimension,
      score: Math.round(score),
      weight: config.dimensions[dimension] ?? DEFAULT_DIMENSION_WEIGHTS[dimension],
      issues: dimIssues,
    };
  });

  const smi = Math.round(
    dimensions.reduce((sum, d) => sum + d.score * d.weight, 0),
  );

  return { smi, dimensions };
}

export function levelOf(smi: number): Level {
  if (smi <= 20) return { name: '清风徐来', advice: '直接合并' };
  if (smi <= 40) return { name: '略有异味', advice: '可以合并' };
  if (smi <= 60) return { name: '熏人上头', advice: '建议收拾后再合并' };
  if (smi <= 80) return { name: '辣眼夺命', advice: 'CI 应拦截' };
  return { name: '生化危机', advice: '拒绝合并' };
}
