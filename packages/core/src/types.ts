export type Severity = 'error' | 'warn' | 'info';

export type Dimension =
  | 'structure'
  | 'abstraction'
  | 'errorHandling'
  | 'typing'
  | 'hygiene'
  | 'engineering';

/** 扫描到的源文件（core 只关心路径与内容，AST 由 analyzer 提供） */
export interface SourceFile {
  path: string;
  relativePath: string;
  content: string;
}

export interface IssueLocation {
  file: string;
  line: number;
  endLine?: number;
}

export interface IssueSuggestion {
  summary: string;
  before?: string;
  after?: string;
  docsUrl?: string;
}

export interface Issue {
  ruleId: string;
  severity: Severity;
  location: IssueLocation;
  snippet: string;
  reason: string;
  suggestion: IssueSuggestion;
}

/** 规则上报时不需要自己填 ruleId / severity，由引擎按规则定义与配置补齐 */
export type RuleIssueInput = Omit<Issue, 'ruleId' | 'severity'> & { severity?: Severity };

export interface RuleConfig {
  enabled?: boolean;
  severity?: Severity;
  baseline?: number;
  options?: Record<string, unknown>;
}

export interface Config {
  rules?: Record<string, RuleConfig>;
  dimensions?: Partial<Record<Dimension, number>>;
  ignore?: string[];
  report?: { maxIssues?: number };
  failOver?: number;
}

export interface ResolvedRuleConfig {
  enabled: boolean;
  severity: Severity;
  baseline: number;
  options: Record<string, unknown>;
}

export interface ResolvedConfig {
  rules: Record<string, ResolvedRuleConfig>;
  dimensions: Record<Dimension, number>;
  ignore: string[];
  report: { maxIssues: number };
  failOver?: number;
}

/* --------------------------- analyzer 提供的能力 --------------------------- */

export interface SymbolRef {
  name: string;
  file: string;
  line: number;
}

export interface InterfaceImpl extends SymbolRef {
  implCount: number;
}

/** L3：跨文件符号解析（需类型信息，由 analyzer-ts 实现） */
export interface SymbolIndex {
  unusedExports(): SymbolRef[];
  interfaceImplementations(): InterfaceImpl[];
}

export interface ForwarderRef {
  name: string;
  file: string;
  line: number;
  snippet: string;
}

export interface FunctionInfo {
  name: string;
  file: string;
  line: number;
  endLine: number;
  lineCount: number;
  /** 最深的控制流嵌套层数（if/for/while/switch/try） */
  maxNesting: number;
  isAsync: boolean;
}

export interface CatchInfo {
  file: string;
  line: number;
  kind: 'empty' | 'onlyLog';
  snippet: string;
}

export interface AsyncCallIssue {
  file: string;
  line: number;
  callee: string;
  /** missing-await = 用了返回值却没 await；floating = 整个调用被丢弃 */
  kind: 'missing-await' | 'floating';
  snippet: string;
}

/** L2：语法树结构查询（由 analyzer-ts 实现） */
export interface AstIndex {
  pureForwarders(): ForwarderRef[];
  functions(): FunctionInfo[];
  catches(): CatchInfo[];
  asyncCallIssues(): AsyncCallIssue[];
}

/* ------------------------------ 规则与上下文 ------------------------------ */

export interface Rule {
  id: string;
  dimension: Dimension;
  /** 1 = 词法/正则，2 = 语法树，3 = 类型与跨文件符号 */
  layer: 1 | 2 | 3;
  severity: Severity;
  /** 每千行代码达到该问题数，即视为该规则满分（用于密度归一化） */
  baseline: number;
  description: string;
  detect(ctx: ScanContext): void | Promise<void>;
}

export interface ScanContext {
  rootDir: string;
  files: SourceFile[];
  config: ResolvedConfig;
  symbols?: SymbolIndex;
  ast?: AstIndex;
  report(issue: RuleIssueInput): void;
}

export interface DimensionScore {
  dimension: Dimension;
  score: number;
  weight: number;
  issues: number;
}

export interface Level {
  name: string;
  advice: string;
}

export interface ScanResult {
  rootDir: string;
  fileCount: number;
  codeLines: number;
  issues: Issue[];
  dimensions: DimensionScore[];
  smi: number;
  level: Level;
}
