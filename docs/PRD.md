# Vibe-Fucking 产品需求文档（PRD）

| 项 | 内容 |
|---|---|
| 版本 | v0.1（草案） |
| 日期 | 2026-10-14 |
| 状态 | 待评审 |
| 命令名 | `vf` |
| npm 包名 | `vibe-fucking` |

---

## 1. 背景与问题

### 1.1 Vibecoding 普及，屎山量产

随着 Cursor、Claude Code、v0、Windsurf 等工具普及，"用自然语言生成整个项目"已成常态。开发者能在几小时内得到一个看似完整的应用：分层清晰、命名规范、注释齐全。但在多轮 AI 会话迭代、拼接之后，项目往往快速腐化成一类**新型屎山**。

### 1.2 AI 屎山与人类屎山形态不同

| | 人类屎山 | AI 屎山 |
|---|---|---|
| 成因 | 赶工、人员流动、没人管 | 每行代码都"认真写过"，但没有任何人对整体负责 |
| 形态 | 混乱、随意、命名投机 | 过度整洁、过度对称、过度防御、**仪式性抽象** |
| 结构 | 逻辑纠缠成一团 | 每个文件都像教科书示例，合在一起是结构精美的屎 |
| 错误处理 | 基本没有 | 到处都是 try/catch，错误被系统性吞掉 |
| 抽象 | 没有或混乱 | 每个概念都要 interface + factory + service 三层 |

AI 屎山的典型指纹：

1. **仪式性抽象**：只有一个实现也要抽 interface；工厂套工厂
2. **纯转发包装**：wrapper 函数体只有一行 `return 调另一个函数`，零增益
3. **防御性冗余**：步步 null check + try/catch + fallback，错误被静默吞掉
4. **工具函数泛滥**：`utils.ts` 导出 30 个只被调用一次的函数
5. **注释复述代码**：`// 计数器加一` 写在 `counter++` 上面
6. **TODO 坟场**：`// TODO: 添加校验` 留了一堆，永不实现
7. **测试真空**：要么零测试，要么测试只 assert "函数能被调用"
8. **async 遗漏**：忘记 `await`，Promise 静默失败

### 1.3 现有工具的盲区

| 工具 | 能查的屎山 | 查不到的屎山 |
|---|---|---|
| ESLint | 风格、少量 bug 模式 | 过度抽象、单实现接口、包装仪式、整体健康度 |
| SonarQube / CodeQL | 经典坏味道、安全漏洞 | AI 特有的结构性屎山；建议可读性差 |
| knip | 未使用导出 / 依赖 | 抽象质量、错误处理、函数规模 |
| 人工 Review | 一切 | 太慢，且 Review 的人自己往往也是 vibecoder |

#### 竞品现状（2026-10 调研）

这个赛道已经不空白了，已存在 Vibe Check、Vibe Code Detector、VibeFix、scanaislop、
Audit Vibe Coding 等同类产品，另有 CodeRabbit、SonarCloud、DeepSource 已内置 AI-specific 规则。
它们的共同形态是：**闭源 SaaS + 上传仓库 + 调 LLM 做综合评审**。

真正的空白在于它们的三个硬伤：

| 硬伤 | 后果 |
|---|---|
| 必须把仓库传到云端 | 企业项目、含敏感代码的项目根本不敢用 |
| 评审结果由 LLM 生成 | 同一份代码每次分数不同，无法作为 CI 门禁复现 |
| 评分是黑盒 | 无法按团队口味调整权重，也不知道分数怎么来的 |

**Vibe-Fucking 的差异化（对应上面三条）**：

1. **完全开源 + 本地运行**，代码不出本机
2. **确定性规则**：同样的代码永远同样的分数，可作为 CI 门禁
3. **屎山指数可解释**：六维度分数公开、每条规则阈值可配置
4. **修正建议带 before/after 代码**，而非"建议重构"这类不可用建议

---

## 2. 产品定位

### 2.1 一句话

> Vibe-Fucking（命令 `vf`）是一个 CLI 工具：扫描 Vibecoding 产出的项目，计算「屎山指数」，输出带 before/after 示例的针对性修正建议。

### 2.2 目标用户与使用场景

| 用户 | 场景 | 用法 |
|---|---|---|
| Vibecoder | AI 写完心里没底，自查项目健康度 | `vf scan .` |
| 技术负责人 | Review AI 产出，代替人肉挑刺 | `vf scan --format html` |
| CI 流水线 | 拦截屎山 MR | `vf scan --fail-over 70` |
| 学习者 | 学习"什么是好代码"的反面教材 | `vf explain <rule>` |

### 2.3 设计原则

1. **建议必须可执行**：每条问题给出 `文件:行号`、屎山成因、before/after 代码。禁止只写"考虑重构"这种废话。
2. **分数必须可信**：误报率是生死线，所有规则可配置、可关闭、默认保守。
3. **零配置可用**：不写任何配置也要能跑出有价值的结果。
4. **产品有性格**：报告文案、等级命名本身就是传播点。

---

## 3. 核心概念：屎山指数（SMI）

**Shit Mountain Index（SMI）**：0-100 的单一综合分，由 6 个维度加权得出。

### 3.1 维度与权重

| 维度 | 权重 | 覆盖 |
|---|---|---|
| 结构 structure | 20% | 文件/函数规模、嵌套深度、循环依赖 |
| 抽象 abstraction | 25% | 仪式性抽象、无价值包装、未使用导出（AI 最重灾区） |
| 错误处理 error-handling | 15% | 空 catch、Promise 未处理、try/catch 密度 |
| 类型 typing | 10% | `any` / `as` / `@ts-ignore` 密度 |
| 卫生 hygiene | 20% | console 残留、TODO 坟场、魔法数、垃圾命名、死代码 |
| 工程 engineering | 10% | 测试缺失、未使用依赖、依赖膨胀 |

### 3.2 计分方式

- 每条规则按**密度**（每千行代码问题数）归一化为 0-100 的规则分；
- 单规则分设封顶（如 60），防止一条规则刷爆维度分；
- 维度分 = 维度内规则分的加权聚合（权重可配置）；
- SMI = 各维度分加权求和；
- 空维度（无适用代码）按满分计并降低其权重，避免"没代码所以不屎"的漏洞。

### 3.3 等级划分

| SMI | 等级 | 文案 | 建议动作 |
|---|---|---|---|
| 0-20 | 清风徐来 | 这代码不像 AI 生的 | 直接合并 |
| 21-40 | 略有异味 | 有屎的香气，但不冲 | 可以合并 |
| 41-60 | 熏人上头 | 待久了会头晕 | 建议收拾后再合并 |
| 61-80 | 辣眼夺命 | Review 时会流泪 | CI 拦截 |
| 81-100 | 生化危机 | 建议焚烧后重写 | 拒绝合并 |

---

## 4. 功能需求

### 4.1 规则体系

⭐ = v0.1 MVP 收录；✅ = 已在骨架中实现（v0.1 先行实现 5 条，覆盖 L1/L2/L3 三层）。
每条规则的详细文档（检测逻辑、正反例、配置项）由 `vf explain <rule-id>` 输出，并维护在 `docs/rules/`。

#### A. 结构类（structure）

| ID | 检测内容 | 默认阈值 | AI 指纹 |
|---|---|---|---|
| ⭐ ✅ `vf/no-god-file` | 单文件过长 | > 500 行 | AI 把整个功能塞进一个文件 |
| ⭐ ✅ `vf/no-god-function` | 函数过长 | > 80 行 | 一个函数干完整条业务流程（v0.2 补语句数判据） |
| ⭐ `vf/no-deep-nesting` | 嵌套过深 | > 4 层 | if/for 套 if/for，AI 不爱提前返回。v0.2 升级为**认知复杂度**（SonarQube 门槛 15），比裸嵌套深度更准 |
| ⭐ ✅ `vf/no-duplicate-logic` | 近似重复逻辑（重叠区间已合并） | 20 token 窗口 | AI 没有项目级记忆，同一逻辑被重新生成多次，每次略有不同（超时值、重试次数、错误处理各写各的） |
| `vf/no-circular-deps` | 循环依赖 | 任意 | 模块互相 import |
| `vf/no-mixed-concerns` | 单文件职责混杂 | > 5 个无关导出 | UI + 数据 + 工具混排 |

#### B. 抽象类（abstraction）

| ID | 检测内容 | 依赖能力 | AI 指纹 |
|---|---|---|---|
| ⭐ ✅ `vf/no-single-impl-interface` | 只有一个实现的 interface | 类型解析 | "面向接口编程"仪式 |
| ⭐ ✅ `vf/no-pure-forwarder` | 纯转发函数 | AST | wrapper 只 return 另一个调用 |
| ⭐ ✅ `vf/no-unused-export` | 无调用方的导出 | 跨文件符号解析 | AI 默认 export 一切 |
| `vf/no-redundant-null-check` | 冗余判空 / 冗余断言 | 类型解析 | 模型在「对冲」而非理解类型系统（DeepSource 的 AI-specific 规则） |
| `vf/no-speculative-config` | 投机性可配置 | 引用分析 | Karpathy Rules：不加没人要的「灵活性」——options 从未被传第二种值 |
| `vf/no-single-use-factory` | 单次调用的工厂 | 引用分析 | `createXxx()` 只在一处用 |
| `vf/no-helper-proliferation` | helper 泛滥 | 统计 | `utils.ts` 导出 > 20 个函数 |
| `vf/no-premature-generic` | 过早泛型 | 类型解析 | 泛型参数只有一种实参 |

#### C. 错误处理类（error-handling）

| ID | 检测内容 | AI 指纹 |
|---|---|---|
| ⭐ ✅ `vf/no-empty-catch` | 空 catch / 只 log 的 catch | 错误被静默吞掉（空=error，只 log=warn） |
| ⭐ ✅ `vf/no-missing-await` | async 调用未 await | 把 Promise 当值用，异步 bug 静默失败 |
| ⭐ ✅ `vf/no-floating-promise` | 未处理的 Promise | 整个 async 调用被丢弃，失败无人知晓 |
| `vf/no-try-catch-spam` | try/catch 密度过高 | 每 50 行一个 try |
| `vf/no-silent-fallback` | catch 后返回默认值 | 掩盖错误，假成功 |

#### D. 类型类（typing）

| ID | 检测内容 | 默认阈值 |
|---|---|---|
| ⭐ ✅ `vf/no-any-spam` | `any` 密度 | 基线 25 个/千行（实测 AI 代码可达 50+） |
| ⭐ ✅ `vf/no-assert-abuse` | `as` 断言密度 | 基线 15 个/千行（排除 `as const`） |
| `vf/no-ts-ignore` | `@ts-ignore` / `@ts-nocheck` | 任意出现 |
| `vf/no-non-null-assertion` | `!.` 断言密度 | > 10 个/千行 |

#### E. 卫生类（hygiene）

| ID | 检测内容 | AI 指纹 |
|---|---|---|
| ⭐ ✅ `vf/no-console-leftover` | 生产代码 `console.log` | 调试残留 |
| ⭐ ✅ `vf/no-todo-graveyard` | TODO/FIXME 堆积 | 基线 3 个/千行，级别 info |
| `vf/no-magic-numbers` | 魔法数字 / 字符串 | 业务常量散落 |
| `vf/no-lazy-naming` | 垃圾命名 | `a` / `tmp` / `data2` / `obj` / `res` |
| ⭐ ✅ `vf/no-dead-code` | return/throw 后的不可达代码 + 未使用局部变量 | AI 留的"备用实现"。**2026 大规模扫描显示死代码在 63% 的 AI 仓库出现——比多数已上线规则更普遍** |
| ⭐ ✅ `vf/no-commented-out-code` | 大段被注释掉的代码（跳过 JSDoc） | "留着以后用"的幻觉，实测 59% 普遍度 |
| `vf/no-comment-noise` | 注释复述代码 | `// i++` 风格注释 |

#### F. 工程类（engineering）

| ID | 检测内容 | AI 指纹 |
|---|---|---|
| ⭐ ✅ `vf/no-test-desert` | 测试文件占比过低 | 项目级二值判定，占比 < 10% 时 warn |
| ⭐ ✅ `vf/no-unused-deps` | `package.json` 未使用依赖 | AI 推荐装一堆，最后只用两个 |
| `vf/no-dependency-bloat` | 依赖膨胀 | > 150 个，或重依赖干轻活 |
| ⭐ ✅ `vf/no-hallucinated-import` | 未声明/未安装的包 | package.json + node_modules 比对 | **AI 编造包名（slopsquatting）**：模型凭印象拼出包名，攻击者抢注后一次 `npm install` 就是远程代码执行。ESLint / Sonar 都查不出来 |
| `vf/no-missing-timeout` | 外部请求缺 timeout | AST | AI 写 fetch/axios 常常不设超时，下游挂死就拖垮整条链路 |
| `vf/no-unsafe-retry` | 对非幂等请求重试 | AST | 重试只能用于幂等且瞬时错误，否则会重复扣款/重复下单 |

**MVP 共 17 条 ⭐（原 15 条 + 调研新增的 `no-duplicate-logic`、`no-hallucinated-import`），
已全部实现 ✅，覆盖 L1 词法 / L2 语法树 / L3 类型符号三层。**

实测（126 行演示项目）：SMI 77「辣眼夺命」，36 处问题，
抽象维度满分（14 处）、类型满分（9 处）——与「AI 屎山重灾区在抽象层」的判断一致。

> **阈值校准提醒**：当前阈值均为拍定值。实测 AI 代码的 `any` 密度可达 50+/千行（原定阈值 10），
> 说明默认值整体偏紧。批量上线前必须用 `scripts/probe.mjs` 在真实项目上回归校准。

### 4.2 问题条目与修正建议的数据结构

每条规则产出统一的 Issue：

```ts
interface Issue {
  ruleId: string;      // 'no-single-impl-interface'
  severity: 'error' | 'warn' | 'info';
  location: {
    file: string;      // 相对路径
    line: number;
    endLine?: number;
  };
  snippet: string;     // 现场代码（带上下文）
  reason: string;      // 屎山成因：AI 为什么这么写、后果是什么
  suggestion: {
    summary: string;   // 一句话修正方向
    before?: string;   // 修正前代码（默认取现场）
    after?: string;    // 修正后示例代码（差异化的核心）
    docsUrl?: string;  // 规则文档锚点
  };
}
```

`suggestion.after` 是产品差异化的核心：**必须是能直接参考照抄的具体代码，不是"建议抽取函数"这种废话**。

### 4.3 报告输出

| 格式 | 说明 |
|---|---|
| `terminal`（默认） | SMI + 维度雷达 + Top N 问题详情 |
| `json` | 完整 Issue 数组，供工具链消费 |
| `html`（v0.2） | 自包含单文件报告，可分享、可归档 |

终端报告样例见附录 A。

### 4.4 CLI 命令

```bash
vf scan [path]                    # 扫描，默认 ./
  --rule <id>                     # 只跑指定规则（可多次）
  --format <terminal|json|html>   # 输出格式
  --out <file>                    # 报告输出到文件
  --fail-over <n>                 # SMI 超过 n 退出码 1
  --max-issues <n>                # 详情最多展示条数，默认 10
  --quiet                         # 只输出分数

vf score [path]                   # 只打印分数（CI 日志友好）
vf explain <rule-id>              # 规则文档：检测逻辑、正反例、配置项
vf list-rules                     # 列出全部规则及默认状态
vf init                           # 生成 .vibe-fucking.json
vf version
```

退出码约定：`0` = 通过；`1` = SMI 超阈值或存在 error 级问题；`2` = 工具自身错误。

### 4.5 配置

`.vibe-fucking.json`（v0.2 起支持 `vibe-fucking.config.ts`）：

```jsonc
{
  "rules": {
    "no-god-file":    { "maxLines": 600, "severity": "warn" },
    "no-any-spam":    { "maxPerKloc": 8 },
    "no-test-desert": { "enabled": false }
  },
  "dimensions": {
    "abstraction": 0.30          // 自定义维度权重
  },
  "ignore": ["**/generated/**", "**/*.gen.ts", "test/**"],
  "report": { "maxIssues": 20 }
}
```

### 4.6 CI 集成

```yaml
# .github/workflows/vibe-check.yml
jobs:
  vibe-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npx vibe-fucking scan --fail-over 70 --format json --out report.json
      - uses: actions/upload-artifact@v4   # 报告归档
```

---

## 5. 非功能性需求

| 项 | 目标 |
|---|---|
| 性能 | 1 万行项目 < 10s；10 万行 < 60s（大仓库增量模式 v0.5） |
| 误报率 | 每条规则上线前在 ≥ 5 个真实项目上人工核验；误报率 > 10% 的规则不上线 |
| 可移植性 | Node >= 18，v0.x 零原生依赖（纯 JS） |
| 可扩展 | 规则、报告格式、分析器均可通过插件扩展 |

---

## 6. 技术架构

### 6.1 选型结论：TypeScript + Node.js

**结论**：工具本身用 TypeScript 编写，运行在 Node.js（>= 18），AST 分析基于 TypeScript Compiler API（ts-morph 封装）。

理由按重要性排序：

**1. 分析对象就是 JS/TS，而类型信息只有 TS Compiler API 能给全。**
Vibecoding 产出集中在 TS/JS 生态（Next.js、React、Vue、Node、Bun/Deno）。本产品价值最高的几条规则——`no-unused-export`、`no-dead-code`、`no-single-impl-interface`、`no-floating-promise`——全部需要**跨文件符号解析与类型推导**。主流替代方案 tree-sitter 只提供语法树、没有类型层，这几条规则做不了。TS Compiler API 是唯一能完整提供 JS/TS 类型信息的基础设施，ts-morph 是其友好封装。

**2. 分发与 CI 集成零摩擦。**
目标用户是 npm 生态原住民：`npx vf scan` 即用，无需安装；CI 里 node 是标配运行时，GitHub Action 直接可用。同生态先例（ESLint、knip、dependency-cruiser、madge）全部选择 TS，不是巧合。

**3. 插件生态与贡献者基数最大。**
规则插件 = TS 接口 + npm 包；vibecoding 社区本身就是 JS 社区，写规则的人最多、门槛最低。

**4. Dogfooding。**
工具自身是 TS 项目，可以用 vf 扫自己，README 说服力强。

其他方案不选的原因：

| 方案 | 不选的原因 |
|---|---|
| Python | 强在分析 Python 项目；但本工具第一战场是 TS 项目，拿不到类型层，最值钱的规则做不了。v0.5 做 Python 分析器时再引入 |
| Rust / Go | 单二进制分发是优势，但规则需要高频迭代调阈值降误报，编译型语言拖慢节奏；且 Rust 生态对 TS 类型解析为零（swc 明确不做类型检查）。可作为 v2 重写或 WASM 加速方向 |
| 纯正则 / ripgrep 脚本 | 只能做卫生类规则，结构与抽象类必须 AST，产品天花板太低 |

### 6.2 仓库结构

```
Vibe-Fucking/
├── packages/
│   ├── core/           # 规则引擎：注册表、调度、密度归一化、SMI 计算
│   ├── analyzer-ts/    # TS/JS 分析层：ts-morph 封装、符号表、类型解析、跨文件引用
│   ├── rules/          # 内置规则库
│   ├── report/         # terminal / json / html 渲染器
│   └── cli/            # 命令解析、配置加载、退出码
├── fixtures/           # 规则测试用的正反例项目
├── docs/               # 本文档 + 规则文档
├── examples/           # 真实项目扫描报告样例
└── ...
```

### 6.3 插件 API（v0.3 开放，core 从第一天按此形态设计）

```ts
import { defineRule } from '@vibe-fucking/core';

export default defineRule({
  id: 'no-single-impl-interface',
  dimension: 'abstraction',
  severity: 'error',
  detect(ctx: ScanContext) {
    // ctx.symbols: 跨文件符号表；ctx.report(issue)：上报
  },
  suggest(issue: Issue) {
    return {
      summary: '删除接口直接使用类，确有多实现时再抽取',
      after: 'class UserService { ... }',
    };
  },
});
```

### 6.4 分析能力分层

| 层 | 能力 | 用途 |
|---|---|---|
| L1 词法 / 正则 | console、TODO、命名 | 卫生类规则，快 |
| L2 语法树 AST | 函数长度、嵌套深度、空 catch | 结构 / 错误处理类规则 |
| L3 类型 + 跨文件符号 | 未使用导出、单实现接口、浮动 Promise | 抽象类规则（高价值） |

三层按需启用：L1/L2 秒出；L3 在大仓库上可关闭以保证性能。

---

## 7. 路线图

| 版本 | 主题 | 内容 |
|---|---|---|
| v0.1 | 跑通闭环 | ✅ 17 条 MVP 规则全部实现 + 终端报告 + SMI 评分 + 配置加载。剩余工作：阈值校准 |
| v0.2（当前） | ✅ 19 条规则（+`no-dead-code`/`no-commented-out-code`，含第 5 个误报源修复）；剩余：HTML 报告、SMI bands 定稿、`vibe-fucking.config.ts` |
| v0.3 | 生态 | 插件 API、社区规则注册机制、`vf fix`（安全规则自动修复） |
| v0.5 | 多语言 | Python 项目分析器（轻量 AST）、增量扫描 |
| v1.0 | 稳定 | 规则集冻结 major、GitHub Action 上架 Marketplace、规则文档站 |

---

## 8. 开源策略

- **License**：MIT
- **包名**：npm `vibe-fucking`，CLI 命令 `vf`
- **贡献流程**：规则 PR 必须包含 ① 正反例 fixture ② 规则文档（含 before/after）③ 单元测试 ④ 在真实项目上的核验记录
- **冷启动传播**：发布时扫描一批知名 vibecoding 项目，公开报告作为 README 素材——这个产品自带传播性
- **品牌风险**：名称可能被部分企业安全策略 / 镜像站屏蔽；README 与传播物料需准备正式副标题（如 "Shit Mountain Detector for Vibe-Coded Projects"）

---

## 9. 校准与基准（基于公开研究，2026-10）

> 状态：3a 研究合成完成；绝对阈值 / 误报率仍需 3b（真实仓库运行）补齐。

### 9.1 研究来源与核心数字

| 研究 | 样本 | 关键数字 |
|---|---|---|
| **ogbuilds — quality·vibes** | 549 个自称 AI 生成仓库，纯确定性规则引擎（关闭 LLM 复审） | 重复逻辑 **55.6%**、死代码 **63.2%**、注释掉代码 **59.2%**、文件 >600 行 **56–60%**、深层嵌套 **53.6%**、中位数质量分 89(B) / 均值 80.7、13% 评 F |
| **GitClear** | 2.11 亿行变更（2020–2024） | 复制粘贴代码 8.3%→**12.3%**；重构(移动)代码 25%→**<10%**；churn 3.3%→**7.1%**(翻倍)；5+ 行重复块提交 1.8%→**6.7%**(4 倍) |
| **CodeRabbit** | 大规模 PR 对比（2025） | AI vs 人类：逻辑/正确性错 **1.75×**、质量/可维护性 **1.64×**、安全 **1.57×**、性能 **1.42×** |
| **那不勒斯大学** | 50 万样本（Py+Java，2025） | AI 代码"更简单、更重复、更多未使用构造与硬编码调试"；人类代码"更复杂但可维护性问题更集中" |

### 9.2 指纹假设验证：成立 ✅

"AI 屎山 = 重复 + 仪式性抽象 + 死代码 + 防御性冗余"在四个独立研究、跨平台（Lovable/v0/Replit/通用 Copilot）、跨语言（JS/TS/Py/Java）上一致成立。ogbuilds 与 GitClear 均用确定性度量（非 LLM），可复现。

### 9.3 对当前 17 条规则基线的影响

| 规则 | 真实普遍度 | 结论 |
|---|---|---|
| `no-duplicate-logic` | 55.6% 仓库存在 | 方向正确，会命中大多数 AI 项目 |
| `no-god-file` | 56–60% 仓库有 >600 行文件 | **阈值已从 500 调至 600**（对齐实测拐点） |
| `no-deep-nesting` | 53.6% 仓库 | 方向正确 |
| `no-any-spam` / `no-console` / `no-empty-catch` | ogbuilds 未单列，但 IndieHackers(10 仓库/4513 问题) 定性确认"any 散落、console 遗留、catch 吞错" | 方向正确，**绝对密度待 3b** |

### 9.4 校准陷阱（重要）

ogbuilds 的"质量分"中位数 89、均值 80.7，反演成我们的 SMI 约 11–19——与 demo 跑出的 77 严重冲突。
说明**评分尺度尚未校准**，绝对阈值与 bands 不能拍脑袋反推。当前 SMI 的五个等级（清风徐来 / 略有异味 / 熏人上头 / 辣眼夺命 / 生化危机）**保持 provisional**，等 3b 拿到真实 SMI 分布再定稿。

### 9.5 因研究新增的规则

- `no-dead-code`（死代码 + 注释掉代码）：63.2% + 59.2% 普遍度，比多数已上线规则更常见 → **v0.2 最高优先级**，与 `no-commented-out-code` 一并实现。

### 9.6 产品信号

ogbuilds 本身就是"确定性、无 LLM、可复现"的扫描器（SaaS 形态），正面印证我们的核心差异化；
它未做 before/after 建议、开源本地化、可配置权重——这三块是我们的护城河。其"≤15 文件的玩具仓库轻松拿 A"发现，也与我们已有的"<500 行密度噪声警告"一致。

### 9.7 3b 对照组实测：一次暴露两个系统性误报源

对照组样本：`sindresorhus/ky`（公认高质量 TS 库，98 文件 / 29534 行），`--depth 1` 浅克隆、不装依赖直接跑。

首轮结果看着"完美"（SMI 18），但单看规则计数完全不成立：

| 规则 | 修复前 | 修复后 | 说明 |
|---|---|---|---|
| `no-duplicate-logic` | **1450** | **14** | 8064 行的 `test/hooks.ts` 撑起了绝大部分匹配 |
| `no-assert-abuse` | **417** | **53** | JSDoc 英文散文里的 "as well as" 被当成类型断言 |
| `no-console-leftover` | 19 | 0 | 同上，注释里的 console 字样 |
| `no-any-spam` | 29 | 11 | 同上 |
| `no-hallucinated-import` | 9 | ≈0 | JSDoc `@example` 里的 `import ky from 'ky'` 被当成幻觉依赖 |
| **SMI** | 18 | **6** | 对照组最终落在"清风徐来" |

两个根因（已修复，见 `packages/rules/src/util.ts`）：

1. **测试文件被当生产代码扫描** —— 巨型测试文件把所有密度指标抬高。现只在上报时过滤（`productionFiles`），分析层仍保留测试文件，避免"仅被测试引用的导出"被误判为未使用。
2. **L1 规则只剥 `//` 行注释，没剥块注释/JSDoc** —— 这是最大误报源。新增 `codeLines()` 统一剥离跨行块注释并保持行号对齐。

**修复后对照组剩余检出经人工抽样确认为真货**（如 `undefined as unknown as T` 双重断言、`Object.keys(x) as Array<...>`），密度约 1.8/千行，远低于基线 15 → 类型维度仅 7 分。
**结论：工具在优质代码上表现克制，对照组校准通过。**

**四个系统性误报源均已修复：**

1. **测试文件被当生产代码扫描** —— 巨型测试文件（ky 的 `test/hooks.ts` 达 8064 行）抬高所有密度指标。现只在上报时过滤（`productionFiles`），分析层仍保留测试文件，避免"仅被测试引用的导出"被误判为未使用。
2. **L1 规则只剥 `//` 行注释，没剥块注释/JSDoc** —— 最大误报源。新增 `codeLines()` 统一剥离跨行块注释并保持行号对齐。
3. **`import` 提取正则未锚定行首** —— 会匹配到字符串字面量内部（实测把 `'é 🌍'` 当成包名）。改为锚定 `^\s*import|export ... from`，并补充 `test-d/`（类型测试目录）判定。
4. **`@/` 路径别名被当成幻觉依赖** —— 实验组 `import ... from '@/app'` 被误报为未声明包。排除 `@/`、`~/`、`#/` 前缀及单独的 `@scope`。修复后实验组 SMI 25→24、工程维度 42→38。
5. **解构模式被当成未使用局部变量**（v0.2 新增规则实测发现）—— `no-dead-code` 首版用 `VariableDeclaration.getName()`，对 `const {status = 200} = opts` 返回整段模式文本 `{status = 200, ...}`，不在标识符计数里 → 对照组炸出 **1147** 条误报。修复：只处理 `Node.isIdentifier(nameNode)` 的简单声明。修复后对照组归零，实验组 57 条经抽验为真死代码（`router = useRouter()` 声明后未用等）。

### 9.8 区分度验证：通过 ✅

实验组样本：`AlteredCraft/spaced-repetition-app`（自述为 vibe coding 教学产物，19 文件 / 3312 行）。

| | 对照 `ky`（优质 TS 库，29534 行） | 实验 `t-sra`（AI 生成，3312 行） |
|---|---|---|
| **SMI** | **3 / 100**（清风徐来） | **25 / 100**（略有异味） |
| 结构 | 4 | **50** |
| 抽象 | 3 | **20** |
| 错误处理 | 3 | **33** |
| 工程 | 0 | **42** |

- **区分度 ~8 倍**，方向正确：AI 生成项目指数显著高于优质人类代码。
- 实验组问题剖面与第 1 节的指纹假设一致：`no-duplicate-logic=99`、`no-unused-export=11`、`no-god-function=8`、`no-empty-catch=5`。
- 对照组剩余检出经人工抽样确认为**真货**（`undefined as unknown as T` 等真实断言，密度 1.8/千行，远低于基线 15），非误报。

> 注意事项：实验组仅 3312 行（< 500 行阈值的 toy 效应仍可能干扰），且样本量 n=1。
> 结论方向可信，但**绝对阈值不宜据此定稿**，需扩大样本（≥ 5 个 AI 项目）后再校准 SMI bands。

---

## 10. 风险与开放问题

| # | 问题 | 现状 / 对策 |
|---|---|---|
| 1 | 误报劝退用户 | 规则可单独关闭、阈值可调；上线前真实项目核验 |
| 2 | SMI 权重凭感觉 | 需要一批标注样本（已知优秀项目 vs 已知屎山）做校准 |
| 3 | 修正建议的深度 | v1 做文字建议 + 示例代码；自动 fix 放 v0.3 且仅限安全规则 |
| 4 | 性能天花板 | ts-morph 全量类型解析在超大仓库慢；L3 可关 + 增量扫描 |
| 5 | 命名合规风险 | 见第 8 节品牌风险 |

---

## 附录 A：终端报告样例

```
🔍 Vibe-Fucking v0.1.0

项目: my-vibe-app    文件: 142    代码行: 8,431

屎山指数: 67/100   😷 熏人上头 — 建议重构后合并

结构      78  ████████░░
抽象      85  █████████░   ← 重灾区
错误处理   42  ████░░░░░░
类型      61  ███████░░░
卫生      55  █████░░░░░
工程      80  ████████░░

共发现 38 处问题（展示前 10 条）:

[vf/no-single-impl-interface] 严重 · src/services/userService.ts:12
 屎山成因: AI 惯性"面向接口编程"，实际只有 UserService 一个实现，
           抽象纯属仪式，改接口要动两个文件
 修正建议: 删除接口直接使用类；确有多实现时再抽取不迟
   - interface IUserService { getUser(id: string): Promise<User> }
   - class UserService implements IUserService { ... }
   + class UserService { getUser(id: string): Promise<User> { ... } }

[vf/no-empty-catch] 严重 · src/lib/api.ts:47
 屎山成因: 请求失败被静默吞掉，用户看到的是"没反应"而非错误
 修正建议: 至少向上抛出或返回 Result 类型，禁止裸 catch
   - } catch (e) {}
   + } catch (e) { throw new ApiError('fetchUser failed', { cause: e }) }

... 完整报告见 vf report.html
```

## 附录 B：术语表

| 术语 | 含义 |
|---|---|
| SMI | Shit Mountain Index，屎山指数 |
| 屎山 | 结构精美但质量低劣、难以维护的代码堆 |
| 密度 | 每千行代码（KLOC）的问题数，用于跨项目归一化 |
| L1/L2/L3 | 分析能力分层：词法 / 语法树 / 类型与跨文件符号 |
