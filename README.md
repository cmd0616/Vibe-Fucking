# Vibe-Fucking

> Shit Mountain Detector for Vibe-Coded Projects
> 检测 Vibecoding 项目里的屎山，并给出针对性修正建议。

```bash
npx vibe-fucking scan          # 或本地：npm run vf -- scan .
```

---

## 为什么需要它

AI 写代码的屎山和人类写的**形态不同**：

| | 人类屎山 | AI 屎山 |
|---|---|---|
| 形态 | 混乱、随意、命名投机 | 过度整洁、过度对称、过度防御、**仪式性抽象** |
| 结构 | 逻辑纠缠成一团 | 每个文件都像教科书示例，合在一起是结构精美的屎 |
| 错误处理 | 基本没有 | 到处是 try/catch，错误被系统性吞掉 |
| 抽象 | 没有或混乱 | 一个实现也要抽 interface + factory + service 三层 |

通用 Linter（ESLint / SonarQube）查的是「经典坏味道」和风格问题，抓不到这些 AI 特有的结构性屎山。
Vibe-Fucking 只做一件事：**找出 AI 生成代码的指纹，告诉你屎在哪、为什么屎、怎么改**。

### 和同类工具的区别

市面上已有 Vibe Check、Vibe Code Detector、VibeFix、scanaislop 等同类产品，但它们几乎都是
「闭源 SaaS + 上传仓库 + 调 LLM 做综合评审」。Vibe-Fucking 的差异是：

1. **完全开源、本地运行** —— 代码不出本机，企业项目也能用
2. **确定性规则** —— 同样的代码永远得到同样的分数，不依赖 LLM，可作为 CI 门禁复现
3. **建议带 before/after 代码** —— 不是「建议重构」这种废话
4. **屎山指数可解释** —— 六个维度分数、每条规则阈值全部可配置

---

## 快速开始

```bash
git clone <repo> && cd Vibe-Fucking
npm install

npm run vf -- scan ./某个-vibecoding-项目
npm run vf -- score ./某个-vibecoding-项目     # 只输出指数，适合 CI 日志
npm run vf -- list-rules
npm run vf -- explain no-single-impl-interface
```

### 命令

| 命令 | 说明 |
|---|---|
| `vf scan [路径]` | 扫描并输出报告（默认） |
| `vf score [路径]` | 只输出屎山指数 |
| `vf list-rules` | 列出内置规则 |
| `vf explain <规则ID>` | 查看单条规则说明 |

选项：`--rule <id>`（只跑指定规则，可重复）、`--format terminal|json`、`--out <file>`、
`--fail-over <n>`（超阈值退出码 1）、`--max-issues <n>`、`--quiet`。

退出码：`0` 通过 / `1` 超过 `--fail-over` / `2` 工具自身错误。

---

## 屎山指数（SMI）

0-100 的综合分，由六个维度加权：

| 维度 | 权重 | 覆盖 |
|---|---|---|
| 结构 | 20% | 重复逻辑、文件/函数规模、嵌套深度 |
| 抽象 | 25% | 仪式性抽象、纯转发包装、未使用导出（AI 最重灾区） |
| 错误处理 | 15% | 空 catch、Promise 未处理 |
| 类型 | 10% | `any` / `as` / `@ts-ignore` 密度 |
| 卫生 | 20% | console 残留、TODO 坟场、垃圾命名、死代码 |
| 工程 | 10% | 幻觉依赖、测试缺失、依赖膨胀 |

| 分数 | 等级 | 建议动作 |
|---|---|---|
| 0-20 | 清风徐来 | 直接合并 |
| 21-40 | 略有异味 | 可以合并 |
| 41-60 | 熏人上头 | 建议收拾后再合并 |
| 61-80 | 辣眼夺命 | CI 拦截 |
| 81-100 | 生化危机 | 拒绝合并 |

计分方式：每条规则按**密度**（每千行问题数）归一化成 0-100，达到该规则的 `baseline` 即满分；
维度分取该维度内规则分的均值；SMI 为各维度加权求和。

---

## 内置规则（v0.1）

**L1 词法/正则**

| ID | 维度 | 级别 | 检测内容 |
|---|---|---|---|
| `no-console-leftover` | 卫生 | warn | 生产代码里残留的 `console` |
| `no-hallucinated-import` | 工程 | error | 未声明/未安装的包（AI 幻觉依赖，含 slopsquatting 风险） |
| `no-any-spam` | 类型 | warn | `any` 密度过高 |
| `no-assert-abuse` | 类型 | warn | `as` 断言密度过高 |
| `no-todo-graveyard` | 卫生 | info | TODO / FIXME 堆积 |
| `no-commented-out-code` | 卫生 | info | 大段被注释掉的代码（跳过 JSDoc） |
| `no-test-desert` | 工程 | error | 项目缺少测试或测试占比过低 |
| `no-unused-deps` | 工程 | warn | 声明但从未 import 的依赖 |
| `no-god-file` | 结构 | warn | 单文件过长（默认 > 500 行） |

**L2 语法树（ts-morph）**

| ID | 维度 | 级别 | 检测内容 |
|---|---|---|---|
| `no-pure-forwarder` | 抽象 | warn | 函数体只有一行 return 调用的零增益包装 |
| `no-god-function` | 结构 | warn | 函数过长（默认 > 80 行） |
| `no-deep-nesting` | 结构 | warn | 控制流嵌套过深（默认 > 4 层） |
| `no-empty-catch` | 错误处理 | error/warn | 空 catch（error）/ 只 log 的 catch（warn） |
| `no-missing-await` | 错误处理 | error | 调 async 函数没 await，把 Promise 当值用 |
| `no-floating-promise` | 错误处理 | warn | async 调用被整个丢弃 |
| `no-duplicate-logic` | 结构 | warn | 近似重复逻辑（20 token 窗口，重叠区间已合并） |
| `no-dead-code` | 卫生 | warn | return/throw 后的不可达代码 + 未使用的局部变量 |

**L3 类型与跨文件符号**

| ID | 维度 | 级别 | 检测内容 |
|---|---|---|---|
| `no-single-impl-interface` | 抽象 | error | 只有一个实现的 interface |
| `no-unused-export` | 抽象 | warn | 全项目无人引用的导出 |

> 两条启发式规则会命中合理代码：`no-pure-forwarder` 会命中薄封装（如 `deepClone`），
> `no-missing-await` 基于「项目内 async 函数名」做匹配，对外部库的异步方法无感。
> 这类规则默认只给 warn，且可按项目关掉。

---

## 配置

在项目根目录放 `.vibe-fucking.json`（可参考 `vibe-fucking.example.json`）：

```jsonc
{
  "rules": {
    "no-console-leftover": { "enabled": false },
    "no-single-impl-interface": { "severity": "warn", "baseline": 8 }
  },
  "dimensions": { "abstraction": 0.3 },
  "ignore": ["**/generated/**", "**/*.gen.ts"],
  "report": { "maxIssues": 20 },
  "failOver": 70
}
```

- `baseline`：每千行达到该问题数即视为该规则满分（调大 = 放宽）
- `severity` / `enabled`：逐条规则覆盖默认行为
- `failOver`：等价于默认 `--fail-over`

---

## CI 集成

```yaml
- uses: actions/setup-node@v4
- run: npx vibe-fucking scan --fail-over 70 --format json --out report.json
```

---

## 仓库结构

```
packages/
├── core/         规则引擎：调度、配置合并、密度归一化、SMI 计算
├── analyzer-ts/  ts-morph 封装：L2 语法树查询 + L3 跨文件符号解析
├── rules/        内置规则（每条 = 检测器 + before/after 建议）
├── report/       terminal / json 渲染器
└── cli/          vf 命令入口与退出码
scripts/probe.mjs       Step 0 探针：验证指纹假设、测阈值量级（零依赖）
scripts/calibrate.mjs   3b 校准：对多仓库跑 vf scan 并输出对比表
calib/                 真实校准样本（浅克隆的对照/实验组仓库）
fixtures/              规则测试用的真·屎山样例
```

`core` 不依赖任何 analyzer —— L2/L3 能力通过 `prepare()` 注入，
因此后续接 Python / Go 分析器不需要改引擎。

写一条新规则：实现 `Rule` 接口（`detect(ctx)` + 上报 `Issue`），
塞进 `packages/rules/src/index.ts` 的 `allRules` 即可。

---

## 校准现状

### 已完成

1. **指纹假设验证**：ogbuilds（549 个 AI 生成仓库的确定性扫描）、GitClear（2.11 亿行变更）、
   CodeRabbit、那不勒斯大学（50 万样本）四项独立研究一致证实：AI 代码的重复、死代码、
   深层嵌套、仪式性抽象显著高于人类代码。详见 [`docs/PRD.md` 第 9 节](docs/PRD.md)。
2. **误报校准**（真实仓库实测）：
   | 规则 | 修复前 | 修复后 | 根因 |
   |---|---|---|---|
   | `no-duplicate-logic` | 1450 | 13 | 8064 行测试文件被当生产代码 |
   | `no-assert-abuse` | 417 | 53 | JSDoc 英文散文被当成类型断言 |
   | `no-hallucinated-import` | 9 | 0 | JSDoc `@example` / 未锚定的 import 正则 / `@/` 路径别名 |
   | `no-dead-code` | 1147 | 0 | 解构模式 `getName()` 返回整段文本，非标识符 |
3. **区分度验证**：

   | | 对照 `ky`（优质库，29534 行） | 实验 `t-sra`（AI 生成，3312 行） |
   |---|---|---|
   | SMI | **3** 清风徐来 | **24** 略有异味 |
   | 结构 / 抽象 / 工程 | 4 / 3 / 0 | 50 / 20 / 38 |

### 局限（v0.1 尚未解决）

- 实验组仅 1 个小样本，**SMI 的五个等级 bands 仍是 provisional**，不能据此定稿
- `no-missing-await` 只认项目内声明的 async 函数，对外部库异步方法无感
- `no-god-function` 只按行数，未实现「> 50 语句」判据
- `no-deep-nesting` 用裸嵌套深度，未升级为认知复杂度

### 自己跑校准

```bash
# 量级探针（零依赖，只判断量级、不作判定）
node scripts/probe.mjs <AI 项目> <已知优质项目>

# 精确校准对比表（对多个仓库跑 vf scan 并汇总）
node scripts/calibrate.mjs <repo1> [repo2 ...]
```

---

## 路线图

| 版本 | 内容 |
|---|---|
| v0.1 | ✅ 17 条规则 + 终端报告 + SMI + 配置；四项误报修复 + 区分度验证完成 |
| v0.2（当前） | ✅ 19 条规则（+`no-dead-code`/`no-commented-out-code`）；剩余：HTML 报告、SMI bands 定稿、`vibe-fucking.config.ts` |
| v0.3 | 插件 API、社区规则机制、`vf fix`（安全规则自动修复） |
| v0.5 | Python 项目分析器、增量扫描 |
| v1.0 | 规则集稳定、GitHub Action 上架 |

完整设计见 [`docs/PRD.md`](docs/PRD.md)。

---

## License

MIT
