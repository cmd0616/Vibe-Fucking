import { relative } from 'node:path';
import { ModuleKind, Node, Project, ScriptTarget, SyntaxKind } from 'ts-morph';
import type {
  AstIndex,
  AsyncCallIssue,
  CatchInfo,
  DeadCodeRef,
  ForwarderRef,
  FunctionInfo,
  InterfaceImpl,
  SourceFile,
  SymbolIndex,
  SymbolRef,
} from '@vibe-fucking/core';

export interface TsAnalyzer {
  symbols: SymbolIndex;
  ast: AstIndex;
}

interface FnEntry {
  name: string;
  file: string;
  node: Node;
}

const NESTING_KINDS = [
  SyntaxKind.IfStatement,
  SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.WhileStatement,
  SyntaxKind.DoStatement,
  SyntaxKind.SwitchStatement,
  SyntaxKind.TryStatement,
];

/** 计算函数体内控制流的最大嵌套层数 */
function maxNestingOf(node: Node): number {
  let max = 0;
  const walk = (current: Node, depth: number): void => {
    const next = NESTING_KINDS.includes(current.getKind()) ? depth + 1 : depth;
    if (next > max) max = next;
    current.forEachChild((child) => walk(child, next));
  };
  node.forEachChild((child) => walk(child, 0));
  return max;
}

function getFunctionBody(node: Node): Node | undefined {
  if (
    Node.isFunctionDeclaration(node) ||
    Node.isMethodDeclaration(node) ||
    Node.isFunctionExpression(node) ||
    Node.isArrowFunction(node) ||
    Node.isConstructorDeclaration(node)
  ) {
    return node.getBody();
  }
  return undefined;
}

const isAsync = (node: Node): boolean => Node.isAsyncable(node) && node.isAsync();

/**
 * 构建 ts-morph 工程，提供 L2（语法树）与 L3（跨文件符号）能力。
 * 注意：这里只做结构/引用分析，不依赖 tsc 类型检查通过——AI 生成的代码常常编译不过，
 * 但仍然需要被扫描。
 */
export function createTsAnalyzer(rootDir: string, files: SourceFile[]): TsAnalyzer {
  const project = new Project({
    compilerOptions: {
      allowJs: true,
      target: ScriptTarget.ES2022,
      module: ModuleKind.ESNext,
      strict: false,
    },
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });

  if (files.length) {
    project.addSourceFilesAtPaths(files.map((f) => f.path));
  }

  const relOf = (absolute: string): string => relative(rootDir, absolute).replace(/\\/g, '/');

  /** 全项目函数节点：纯转发、函数规模、嵌套深度都基于它 */
  const fnEntries: FnEntry[] = [];
  for (const sf of project.getSourceFiles()) {
    if (sf.isDeclarationFile()) continue;
    const rel = relOf(sf.getFilePath());

    for (const fn of sf.getFunctions()) {
      const name = fn.getName();
      if (name) fnEntries.push({ name, file: rel, node: fn });
    }
    for (const cls of sf.getClasses()) {
      for (const method of cls.getMethods()) {
        const name = method.getName();
        if (name) fnEntries.push({ name, file: rel, node: method });
      }
      for (const ctor of cls.getConstructors()) {
        fnEntries.push({ name: 'constructor', file: rel, node: ctor });
      }
    }
    for (const decl of sf.getVariableDeclarations()) {
      const init = decl.getInitializer();
      if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
        fnEntries.push({ name: decl.getName(), file: rel, node: init });
      }
    }
  }

  /** 全项目标识符出现次数：用于判断「导出后无人使用」 */
  const nameCounts = new Map<string, number>();
  for (const sf of project.getSourceFiles()) {
    for (const id of sf.getDescendantsOfKind(SyntaxKind.Identifier)) {
      const text = id.getText();
      nameCounts.set(text, (nameCounts.get(text) ?? 0) + 1);
    }
  }

  /** 项目内声明为 async 的函数名：用于缺失 await / 浮动 Promise 检测 */
  const asyncNames = new Set<string>();
  for (const entry of fnEntries) {
    if (isAsync(entry.node)) asyncNames.add(entry.name);
  }

  const symbols: SymbolIndex = {
    unusedExports(): SymbolRef[] {
      const out: SymbolRef[] = [];
      for (const sf of project.getSourceFiles()) {
        if (sf.isDeclarationFile()) continue;
        const rel = relOf(sf.getFilePath());
        const decls: { name?: string; line: number }[] = [];

        for (const fn of sf.getFunctions()) {
          if (fn.isExported()) decls.push({ name: fn.getName(), line: fn.getStartLineNumber() });
        }
        for (const cls of sf.getClasses()) {
          if (cls.isExported()) decls.push({ name: cls.getName(), line: cls.getStartLineNumber() });
        }
        for (const itf of sf.getInterfaces()) {
          if (itf.isExported()) decls.push({ name: itf.getName(), line: itf.getStartLineNumber() });
        }
        for (const alias of sf.getTypeAliases()) {
          if (alias.isExported()) decls.push({ name: alias.getName(), line: alias.getStartLineNumber() });
        }
        for (const en of sf.getEnums()) {
          if (en.isExported()) decls.push({ name: en.getName(), line: en.getStartLineNumber() });
        }
        for (const stmt of sf.getVariableStatements()) {
          if (!stmt.isExported()) continue;
          for (const d of stmt.getDeclarations()) {
            decls.push({ name: d.getName(), line: d.getStartLineNumber() });
          }
        }

        for (const d of decls) {
          if (!d.name) continue;
          // 声明本身贡献 1 次出现；> 1 说明别处有引用
          if ((nameCounts.get(d.name) ?? 0) <= 1) {
            out.push({ name: d.name, file: rel, line: d.line });
          }
        }
      }
      return out;
    },

    interfaceImplementations(): InterfaceImpl[] {
      const table = new Map<string, InterfaceImpl>();
      for (const sf of project.getSourceFiles()) {
        const rel = relOf(sf.getFilePath());
        for (const itf of sf.getInterfaces()) {
          const name = itf.getName();
          if (!name) continue;
          table.set(name, { name, file: rel, line: itf.getStartLineNumber(), implCount: 0 });
        }
      }

      const bump = (raw: string): void => {
        const base = raw.replace(/<[\s\S]*>/, '').trim();
        const rec = table.get(base);
        if (rec) rec.implCount += 1;
      };

      for (const sf of project.getSourceFiles()) {
        for (const cls of sf.getClasses()) {
          for (const h of cls.getImplements()) bump(h.getText());
          const ext = cls.getExtends();
          if (ext) bump(ext.getText());
        }
        for (const itf of sf.getInterfaces()) {
          for (const h of itf.getExtends()) bump(h.getText());
        }
      }

      return [...table.values()];
    },
  };

  const ast: AstIndex = {
    pureForwarders(): ForwarderRef[] {
      const out: ForwarderRef[] = [];
      for (const entry of fnEntries) {
        const body = getFunctionBody(entry.node);
        if (!body) continue;

        let isForward = false;
        if (Node.isBlock(body)) {
          const stmts = body.getStatements();
          if (stmts.length === 1 && Node.isReturnStatement(stmts[0])) {
            const expr = stmts[0].getExpression();
            isForward = !!expr && Node.isCallExpression(expr);
          }
        } else {
          isForward = Node.isCallExpression(body);
        }

        if (isForward) {
          out.push({
            name: entry.name,
            file: entry.file,
            line: entry.node.getStartLineNumber(),
            snippet: entry.node.getText().split('\n')[0].trim(),
          });
        }
      }
      return out;
    },

    functions(): FunctionInfo[] {
      return fnEntries.map((entry) => {
        const start = entry.node.getStartLineNumber();
        const end = entry.node.getEndLineNumber();
        return {
          name: entry.name,
          file: entry.file,
          line: start,
          endLine: end,
          lineCount: end - start + 1,
          maxNesting: maxNestingOf(entry.node),
          isAsync: isAsync(entry.node),
        };
      });
    },

    catches(): CatchInfo[] {
      const out: CatchInfo[] = [];
      for (const sf of project.getSourceFiles()) {
        if (sf.isDeclarationFile()) continue;
        const rel = relOf(sf.getFilePath());

        for (const tryStmt of sf.getDescendantsOfKind(SyntaxKind.TryStatement)) {
          const clause = tryStmt.getCatchClause();
          if (!clause) continue;

          const block = clause.getBlock();
          const stmts = block.getStatements();
          const line = clause.getStartLineNumber();
          const snippet = clause.getText().split('\n')[0].trim();

          if (stmts.length === 0) {
            out.push({ file: rel, line, kind: 'empty', snippet });
            continue;
          }
          if (
            stmts.length === 1 &&
            Node.isExpressionStatement(stmts[0]) &&
            /^console\.(log|error|warn|info)\(/.test(stmts[0].getText().trim())
          ) {
            out.push({ file: rel, line, kind: 'onlyLog', snippet });
          }
        }
      }
      return out;
    },

    asyncCallIssues(): AsyncCallIssue[] {
      const out: AsyncCallIssue[] = [];
      if (asyncNames.size === 0) return out;

      for (const sf of project.getSourceFiles()) {
        if (sf.isDeclarationFile()) continue;
        const rel = relOf(sf.getFilePath());

        for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
          const calleeText = call.getExpression().getText();
          const base = calleeText.split('.').pop();
          if (!base || !asyncNames.has(base)) continue;

          const parent = call.getParent();
          if (!parent) continue;
          if (Node.isAwaitExpression(parent)) continue;
          if (Node.isVoidExpression(parent)) continue;
          if (Node.isReturnStatement(parent)) continue;
          // Promise.all([...]) 之类的并发写法
          if (Node.isArrayLiteralExpression(parent)) continue;
          // .then() / .catch() 链式处理
          if (Node.isPropertyAccessExpression(parent) && /^(then|catch|finally)$/.test(parent.getName())) {
            continue;
          }

          const isDiscarded = Node.isExpressionStatement(parent);
          out.push({
            file: rel,
            line: call.getStartLineNumber(),
            callee: calleeText,
            kind: isDiscarded ? 'floating' : 'missing-await',
            snippet: call.getText().split('\n')[0].trim(),
          });
        }
      }
      return out;
    },

    deadCode(): DeadCodeRef[] {
      const out: DeadCodeRef[] = [];

      for (const sf of project.getSourceFiles()) {
        if (sf.isDeclarationFile()) continue;
        const rel = relOf(sf.getFilePath());

        // 1) 终止语句之后的不可达代码：只看 return / throw，避开 switch 里 break 的歧义
        for (const block of sf.getDescendantsOfKind(SyntaxKind.Block)) {
          const stmts = block.getStatements();
          const stop = stmts.findIndex((s) => Node.isReturnStatement(s) || Node.isThrowStatement(s));
          if (stop === -1) continue;
          for (const dead of stmts.slice(stop + 1)) {
            out.push({
              file: rel,
              line: dead.getStartLineNumber(),
              kind: 'unreachable',
              name: '',
              snippet: dead.getText().split('\n')[0].trim().slice(0, 120),
            });
          }
        }

        // 2) 未使用的局部变量：统计每个标识符在函数体内的出现次数
        // 名字只出现一次（声明本身）且非 _ 前缀，视为死变量
        const globalCounts = new Map<string, number>();
        for (const id of sf.getDescendantsOfKind(SyntaxKind.Identifier)) {
          const name = id.getText();
          globalCounts.set(name, (globalCounts.get(name) ?? 0) + 1);
        }

        for (const entry of fnEntries) {
          const body = getFunctionBody(entry.node);
          if (!body) continue;
          if (relOf(body.getSourceFile().getFilePath()) !== rel) continue;

          const counts = new Map<string, number>();
          for (const id of body.getDescendantsOfKind(SyntaxKind.Identifier)) {
            const name = id.getText();
            counts.set(name, (counts.get(name) ?? 0) + 1);
          }

          for (const decl of body.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
            // 只处理简单标识符；解构模式 getName() 返回的是 "{a = 1, b}" 这种整段文本，
            // 不在标识符计数里 → 会 100% 误报（实测对照组 1147 条全是这个）
            const nameNode = decl.getNameNode();
            if (!Node.isIdentifier(nameNode)) continue;

            const name = nameNode.getText();
            if (!name || name.startsWith('_')) continue;

            // 若该名字在整个文件里出现得比本函数体多，说明它被模块级或其他函数引用——
            // 这是外层变量（type-fest 的 module-level Map 曾因此误报 180 条）
            if ((globalCounts.get(name) ?? 0) > (counts.get(name) ?? 0)) continue;

            if ((counts.get(name) ?? 0) <= 1) {
              out.push({
                file: rel,
                line: decl.getStartLineNumber(),
                kind: 'unused-local',
                name,
                snippet: decl.getText().split('\n')[0].trim().slice(0, 120),
              });
            }
          }
        }
      }

      return out;
    },
  };

  return { symbols, ast };
}
