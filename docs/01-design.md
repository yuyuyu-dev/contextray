# CtxRay — 项目设计开发文档

> 一个诊断 AI 编码 Agent「上下文浪费」的 CLI 体检工具
> 版本:v0.1(设计稿)· 日期:2026-08-06

---

## 1. 一句话定位

**ctxray 是 AI 编码 Agent 的「上下文碳足迹体检报告」**:一条命令扫描本机会话记录,告诉用户每一轮对话的 token 花在哪、哪个工具在烧钱、配置是不是在浪费钱,并生成一张可分享的浪费体检报告。

和压缩类工具(Headroom / context-mem 负责「事后省钱」)不同,我们做的是**诊断**(「钱为什么没了」),是所有省钱工具的上游入口。

---

## 2. 为什么现在做(背景与差异化)

### 2.1 时代背景
- 2026 年 GitHub 增长最快的项目几乎全是 AI Agent 工具链;Agent 贡献量同比增长 370%。
- 最大痛点是 **Context Bloat / Context Rot**:接 3 个 MCP 服务器,工具 schema 吃掉约 72% 上下文;工具越多,Agent 工具选择准确率从 43% 跌到 14%。
- 「省钱」类项目(`headroom` 压缩 92%、`context-mem` 压缩 99%、`MemWeave` 记忆分层)月增数万星,但**没有一个是先告诉你浪费在哪的**。

### 2.2 差异化
| 维度 | 现有压缩/记忆工具 | ctxray |
|---|---|---|
| 角色 | 事后补救(压缩、记忆) | 事前诊断(体检) |
| 与现有工具关系 | 竞争 | **互补**,是它们的入口 |
| 数据 | 拦截、改写数据流 | **只读**本机会话文件,不碰数据流 |
| 卖点 | 省 92% token | 「你的 AI 每月烧掉 $86 的噪音」 |

### 2.3 已验证的可行性(本机实测)
- Claude Code 会话记录位于 `~/.claude/projects/<slug>/*.jsonl`,本机实测 **39/39 条 assistant 记录均带真实 `usage` 字段**(`input_tokens` / `output_tokens` / `cache_read_input_tokens`),可**精确计量**,非估算。
- **13/13 条 tool_result 均能通过 `tool_use_id` 对应回 tool_use**,可做「哪个工具在烧钱」的归因。

---

## 3. 目标用户与使用场景

**目标用户**:重度使用 Claude Code / Codex 的开发者、以及「AI 编码很贵很慢」的团队。

**核心场景**:
1. 月底想不通「这个月 API 账单怎么这么贵」→ `ctxray scan` 找到元凶。
2. 想优化 CLAUDE.md / MCP 配置但不知道从哪下手 → `ctxray audit-config` 给出清单。
3. 团队管理 agent 成本 → 生成报告归档、对比优化前后。

**非目标(刻意不做)**:
- 不做任何拦截、改写、代理、压缩——那会破坏「本地优先、零侵入」的信任基础。
- 不做实时监控(那是 `tokens-metric` 的活),v1 只做「事后体检」。

---

## 4. 功能设计

### 4.1 命令集(v1)

```
ctxray scan [--agent claude|codex|auto] [--since N] [--project <slug>] [--json]
ctxray report [--path <file.html>] [--open]
ctxray audit-config [--config <CLAUDE.md>] [--mcp <config.json>]
ctxray ls-sessions [--agent claude|codex] [--since N]
```

| 命令 | 作用 |
|---|---|
| `scan` | 扫描会话记录,输出 token 消耗明细与浪费归因。`--json` 输出机器可读快照 |
| `report` | 基于最近一次 scan 快照,生成自包含 HTML 报告 + 终端摘要 |
| `audit-config` | 静态估算 CLAUDE.md / MCP 配置的每会话成本,给优化清单 |
| `ls-sessions` | 列出可扫描的会话(数量、日期、模型、预估成本),`scan` 的数据源预览 |

### 4.2 核心流程

```
scan ──► 发现会话文件(自动探测本机 agent)
        ──► 逐文件解析为统一中间模型
        ──► 精确计量(真实 usage)+ 组件归因(tiktoken)
        ──► 计算 Waste Score + 生成快照(JSON)
        ──► 终端摘要输出

report ──► 读快照 ──► 生成自包含 HTML(内联 SVG 图表,单文件可分享)
```

### 4.3 终端摘要示例(传播钩子)

```
╭─ CtxRay · 2026-07 月度体检 ─────────────────────────╮
│  Agent            Claude Code × 143 个会话                   │
│  总 token         23.6M(input)/ 1.9M(output)                │
│  估算成本         $86.20                                     │
│                                                             │
│  ── 钱去哪了 ──                                              │
│  ████████████████████  68%  工具输出(JSON 噪音)              │
│  ████████               9%   同一文件被读了 47 次             │
│  ████                   4%   报错输出(浪费)                  │
│  ███                    3%   未使用的 MCP 服务器              │
│                                                             │
│  浪费评级            C-(比 63% 的同类配置更费)                │
│  最大元凶            bash + read 高频循环,建议:...            │
╰─────────────────────────────────────────────────────────────╯
  完整报告:ctxray report --open
```

---

## 5. 架构设计

### 5.1 整体架构(数据流)

```
┌────────────┐   ┌──────────────┐   ┌─────────────────┐   ┌───────────┐
│ 数据源层    │──▶│ 解析层(Parser) │──▶│ 分析层(Analyzer) │──▶│ 报告层    │
│ ~/.claude  │   │ claude.ts    │   │ tokens.ts       │   │ text.ts   │
│ ~/.codex   │   │ codex.ts     │   │ pricing.ts      │   │ html.ts   │
└────────────┘   └──────────────┘   │ breakdown.ts    │   └───────────┘
                                    │ watescore.ts    │
                                    └────────┬────────┘
                                             ▼
                                  快照 storage/snapshot.json
```

### 5.2 模块划分

| 模块 | 职责 |
|---|---|
| `sources/detect.ts` | 自动探测 `~/.claude` / `~/.codex` 是否存在,组装可扫描文件清单 |
| `sources/claude.ts` | 解析 Claude Code JSONL → 统一中间模型 |
| `sources/codex.ts` | 解析 Codex rollout JSONL → 统一中间模型 |
| `sources/types.ts` | 统一中间模型定义(见 6.3) |
| `analyze/tokens.ts` | 本地 token 计数(tiktoken cl100k_base 近似) |
| `analyze/pricing.ts` | 模型价格表 + 成本计算,支持 override |
| `analyze/breakdown.ts` | 组件归因:工具输出 / 用户消息 / 上下文基线 / 重复读取 |
| `analyze/watescore.ts` | Waste Score 评分算法 |
| `report/text.ts` | 终端摘要渲染 |
| `report/html.ts` | 自包含 HTML 报告生成 |
| `report/chart.ts` | 内联 SVG 图表(零外部依赖,单文件离线可开) |
| `storage/snapshot.ts` | scan 结果读写(JSON,带 reportHash 字段) |
| `cli.ts` | 命令入口(commander),串起以上流程 |

### 5.3 技术选型(已确认)

| 项 | 选择 | 理由 |
|---|---|---|
| 语言 | Node + TypeScript | `npx ctxray` 一条命令传播最好;本机 Node v25 |
| CLI | commander | 主流、稳定 |
| token 计数 | **零依赖启发式**(CJK 每字符 1 token、其余每 4 字符 1 token) | 原计划 `js-tiktoken`,但实测本机其 import 会挂起(tsx/vitest worker 崩溃);启发式仅用于归因占比,误差不影响真实总额 |
| 图表 | 手写内联 SVG | 报告单文件自包含,离线可开、可分享 |
| 测试 | vitest | 配 fixture 会话文件做快照测试 |
| 存储 | 单 JSON 快照文件 | 无需数据库,`~/.ctxray/snapshot.json` |

> 注:`js-tiktoken` 对中文/代码的计数与真实模型 tokenizer 有偏差,但**总额以真实 `usage` 为准**,tiktoken 只用于把总额按组件占比分配,误差被吸收。这是设计关键点,见 6.4。

### 5.4 项目目录结构

```
ctxray/
  package.json  tsconfig.json  README.md
  bin/ctxray.js              # npm bin 入口
  src/
    cli.ts  config.ts  types.ts
    sources/  detect.ts  claude.ts  codex.ts  types.ts
    analyze/  tokens.ts  pricing.ts  breakdown.ts  watescore.ts
    report/   text.ts  html.ts  chart.ts
    storage/  snapshot.ts
  test/
    fixtures/  claude-sample.jsonl  codex-sample.jsonl
    *.test.ts
  docs/  01-design.md
```

---

## 6. 数据源解析设计(核心)

### 6.1 Claude Code JSONL(本机已实测验证)

- 路径:`~/.claude/projects/<项目slug>/*.jsonl`,每条一行 JSON。
- 记录类型(实测):`user` / `assistant` / `system` / `file-history-snapshot` / `attachment` / `last-prompt` / `ai-title`。
- `assistant` 记录:`message.content` 为块数组(`thinking` / `text` / `tool_use`),`message.usage` 含真实 token 数,`message.model` 为模型名。
- `user` 记录:`message.content` 可能是字符串,或块数组(其中 `tool_result` 块含 `tool_use_id`、`content`、`is_error`)。
- **归因链路**:`user` 块的 `tool_result.tool_use_id` → `assistant` 块的 `tool_use.id` → 拿到工具名(Bash/Read/WebSearch...)。

### 6.2 Codex rollout JSONL

- 路径:`~/.codex/sessions/YYYY/MM/DD/rollout-<id>.jsonl`;归档在 `~/.codex/archived_sessions/`。
- 第 1 行 `SessionMeta`(session id / model / 时间戳);后续行为 `RolloutLine`(响应项或事件)。
- 事件:`token_count`(**累计值**,每轮需与前一条做差)、`turn_started`、`context_compacted`。
- 项目项:`function_call` / `function_call_output` / `user_message` 等。
- token 明细:`event_msg.payload.info.last_token_usage.{input, output, cached_input, reasoning_output}_tokens`。
- **注意**:无逐事件时间戳;`token_count` 为累计、无差分的旧格式(2025-09 前)缺失,需容错跳过并提示。
- **⚠️ 未验证风险(M2 已实现)**:本机无 Codex 安装,解析器基于社区文档格式实现(`envelope{timestamp,type,payload}` / `event_msg.token_count` / `response_item.{message,function_call,function_call_output}`),**未对真实数据验证**。解析器已做防御式处理(跳过未知类型、`info:null` 容错、累计值回归重播种、旧格式兜底),发布前需找一台有 Codex 的机器验证。

### 6.3 统一中间模型(两数据源收敛到这里)

```ts
interface Session {
  id: string;
  agent: 'claude' | 'codex';
  project: string;            // 项目 slug 或目录名
  model: string;
  filePath: string;
  firstTs: number;
  turns: Turn[];
}

interface Turn {              // 每一轮 = 一次 model 调用
  seq: number;
  model: string;
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
  blocks: Block[];
}

type Block =
  | { kind: 'user-text'; text: string }
  | { kind: 'tool-result'; tool: string; toolUseId: string; text: string; isError: boolean }
  | { kind: 'tool-use'; tool: string; toolUseId: string; input: Record<string, unknown> }
  | { kind: 'thinking'; text: string }
  | { kind: 'assistant-text'; text: string }
  | { kind: 'system' };        // 系统提示词/tools schema 基线,不逐字存
```

### 6.4 Token 计量策略(精确 + 归因)

**原则:总额精确、占比归因。**
1. **总额**:每轮 `input`/`output`/`cacheRead` 直接取真实 `usage`,逐轮累加 → 绝对准确。
2. **归因**:对每一轮,把该轮 `tool-result` 块按工具分组,用零依赖启发式计数器计各块 token 数 → 得「工具输出占比」;用户文本同理。原计划的 `system` 基线反推(M2 实测:tiktoken 对中文虚高 + deepseek 类模型 `input_tokens` 仅含新增,导致基线估算失效)已**放弃**,报告改为「内容构成图」统一口径(tool/assistant/user/thinking 均按同一计数器),不再混入不可靠的基线/历史桶。
3. **重复读取检测**:对 `tool-use` 中 `tool=Read/Grep` 且输入含相同文件路径者计数,>1 即计为重复。

### 6.5 成本计算(Pricing)

- `pricing.ts` 内置常见模型价格表(输入 / 输出 / 缓存读取,单位 $/1M tokens),以 `message.model` 匹配。
- 价格为**默认值、可被 `--price-override` 或配置文件覆盖**(M3 实现时核对真实价目)。
- 缓存计费:`cacheRead` 按缓存价、其余按原价,能体现「缓存复用省了多少钱」。

---

## 7. 浪费评级(Waste Score)

### 7.1 评分算法(0–100,越高越浪费)

| 维度 | 权重 | 计算方式 | 判定 |
|---|---|---|---|
| 工具输出噪音 | 40% | 工具输出 token ÷ 总 input token | >60% 视为高 |
| 重复读取 | 25% | 被读 ≥2 次的文件数 ÷ 去重文件数 | >20% 视为高 |
| 无效输出 | 15% | `is_error` 工具结果 token 占比 | >5% 视为高 |
| 缓存利用率 | 10% | (cacheRead+cacheWrite) ÷ input | <20% 视为低效(浪费) |
| 上下文基线 | 10% | system+tools 每轮基线 token | >60K 视为高 |

每维映射到 0–1 子分(线性/分段),加权求和 × 100。
**评级**:A(<20)· B(20–40)· C(40–60)· D(60–80)· F(≥80)。
阈值全部收敛到 `config` 可调,保证评分**可复现、可解释**。

### 7.2 优化建议(基于归因自动生成)

- 工具输出占比高 → 「考虑用 shell 脚本精简输出 / 对高频 JSON 工具开启输出截断」。
- 重复读取高 → 「列出被反复读取的文件,建议用 MCP 代码索引替代裸 read」。
- 无效输出高 → 「检查报错循环,建议设置失败重试上限」。
- 基线膨胀 → 「审查 MCP 服务器数量与 CLAUDE.md 体积,附配置级清单(联动 audit-config)」。

---

## 8. 报告设计(传播核心)

### 8.1 终端摘要
见 4.3。一页纸,含总览、钱去哪了、评级、最大元凶、下一步建议。

### 8.2 HTML 报告(单文件、自包含)
- 内联 CSS + 手写 SVG 图表,**零 CDN、离线可开、可直接发文件给同事**。
- 内容:总览卡片、组件占比饼图、工具烧钱 Top 榜(柱状)、重复读取列表、逐会话时间线、评级与建议、页脚附「生成方式 + 数据仅本机」声明。
- 文件名:`ctx-report-2026-07.html`,README 里放示例图。

### 8.3 匿名汇总钩子(v2,预留)
- 快照 JSON 带 `reportHash`(内容 hash)。
- 预留 `storage/uploader.ts` 接口与「只含统计数字、不含任何路径/代码」的匿名上报 schema。
- **v1 不实现联网**,纯本地是卖点;v2 做公开「Agent 浪费排行榜」。

---

## 9. 隐私与边界

- **只读**:仅读取 `~/.claude` / `~/.codex` 下的会话文件,绝不修改、绝不外发。
- **纯本地**:v1 无任何网络请求,报告单文件离线下发。
- **数据最小化**:代码正文只用于本地统计,快照只存聚合数字 + 文件路径(供报告定位),不存正文。
- **免责声明**:README 与报告页脚明示「数据不离开本机」。

---

## 10. 发布与传播计划

1. **内部验证**:用用户自己的 143 个会话跑通,截图「月度体检」作为传播素材。
2. **社区首帖**:V2EX / 掘金发「我给我自己的 AI 助手做了个体检」+ 报告截图,引导 `npx ctxray scan`。
3. **GitHub 发布**:README 首屏 = 一张报告图 + 一条命令;标注「本地优先 / 零侵入 / 100% 离线」。
4. **借势**:README 关联 `headroom` / `context-mem`(互补声明),参与 Hacker News 讨论串。
5. **后续钩子**:v2 匿名排行榜(社交对比)、支持 Gemini CLI(扩面)。

---

## 11. 风险与应对

| 风险 | 应对 |
|---|---|
| 会话格式随版本变化(尤其 Codex,非官方文档) | 解析器容错:识别失败跳过该文件并提示;fixture 快照测试防回归 |
| 赛道热,30 天内有竞品 | 快速出 MVP;差异化锚定「诊断+可分享报告」,不碰压缩 |
| 评分算法被质疑「不科学」 | 阈值可配置、算法公开、README 写明口径 |
| npm 包名被占 | `ctxray` 被占则用 `@ctxray/cli`;先查 npm |
| 中文/代码 token 近似误差 | 总额用真实 usage,近似只用于占比分配,误差不放大 |

---

## 12. 开发计划与里程碑

> 目标:约 6.5 天出可发布 MVP。每个里程碑带**验证手段**(CLAUDE.md 目标驱动原则)。

| 里程碑 | 内容 | 验证 |
|---|---|---|
| **M0** 脚手架(0.5d) | package.json / tsconfig / bin 入口 / CLI 骨架 / vitest 就绪 | `ctxray --help` 可用;`npm test` 通过 |
| **M1** Claude 解析(1d) | `sources/claude.ts` + fixture(用户真实会话脱敏) | 单测:解析 fixture 后 turns/blocks 数量与预期一致 |
| **M2** Codex 解析(1d) | `sources/codex.ts` + fixture(含 token_count 差分、旧格式容错) | 单测:差分累计 token 正确;旧格式跳过不崩 |
| **M3** 计量与归因(1d) | tokens / pricing / breakdown / watescore | 单测:对已知 fixture 断言成本、占比、评分;核对 pricing 表 |
| **M4** 报告(1.5d) | text.ts + html.ts + chart.ts | 对用户真实会话生成报告,浏览器离线打开核对图表 |
| **M5** audit-config(0.5d) | CLAUDE.md / MCP 配置静态成本估算 | 单测:给定示例配置算出预期成本 |
| **M6** 发布(1d) | 测试补全 / README / 示例图 / npm 发布流程 / 社区帖素材 | 全新环境 `npx ctxray scan` 走通全流程 |

### 12.1 技术债与后续(v1 之后)
- 支持 Gemini CLI / Cursor 会话格式。
- 匿名排行榜服务端 + 上报。
- 连续 N 天报告对比(优化前后)。

---

## 13. 待办 / 开放问题

- [x] npm 包名 `ctxray` **已确认可用**(2026-08-06)。
- [x] 仓库位置 `D:\heima\ctxray` **已确认**(git init 于 M0)。
- [x] README **做多语言可切换(i18n)**,非 v1 优先项(M6 定稿,不急)。
- [ ] M3 时核对主流模型实时价格(填默认值并标注可覆盖)。
