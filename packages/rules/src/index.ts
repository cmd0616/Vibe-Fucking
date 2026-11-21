import type { Rule } from '@vibe-fucking/core';
import { noConsoleLeftover } from './no-console-leftover';
import { noPureForwarder } from './no-pure-forwarder';
import { noSingleImplInterface } from './no-single-impl-interface';
import { noHallucinatedImport } from './no-hallucinated-import';
import { noDuplicateLogic } from './no-duplicate-logic';
import { noGodFile } from './no-god-file';
import { noGodFunction } from './no-god-function';
import { noDeepNesting } from './no-deep-nesting';
import { noUnusedExport } from './no-unused-export';
import { noEmptyCatch } from './no-empty-catch';
import { noMissingAwait } from './no-missing-await';
import { noFloatingPromise } from './no-floating-promise';
import { noAnySpam } from './no-any-spam';
import { noAssertAbuse } from './no-assert-abuse';
import { noTodoGraveyard } from './no-todo-graveyard';
import { noTestDesert } from './no-test-desert';
import { noUnusedDeps } from './no-unused-deps';
import { noDeadCode } from './no-dead-code';
import { noCommentedOutCode } from './no-commented-out-code';

/** 内置规则集（19 条），覆盖 L1 词法 / L2 语法树 / L3 类型符号三层 */
export const allRules: Rule[] = [
  // L1 词法
  noConsoleLeftover,
  noHallucinatedImport,
  noAnySpam,
  noAssertAbuse,
  noTodoGraveyard,
  noTestDesert,
  noUnusedDeps,
  noGodFile,
  noCommentedOutCode,
  // L2 语法树
  noPureForwarder,
  noGodFunction,
  noDeepNesting,
  noEmptyCatch,
  noMissingAwait,
  noFloatingPromise,
  noDuplicateLogic,
  noDeadCode,
  // L3 类型与跨文件符号
  noSingleImplInterface,
  noUnusedExport,
];

export const rulesById: Record<string, Rule> = Object.fromEntries(
  allRules.map((rule) => [rule.id, rule]),
);

export {
  noConsoleLeftover,
  noPureForwarder,
  noSingleImplInterface,
  noHallucinatedImport,
  noDuplicateLogic,
  noGodFile,
  noGodFunction,
  noDeepNesting,
  noUnusedExport,
  noEmptyCatch,
  noMissingAwait,
  noFloatingPromise,
  noAnySpam,
  noAssertAbuse,
  noTodoGraveyard,
  noTestDesert,
  noUnusedDeps,
  noDeadCode,
  noCommentedOutCode,
};
