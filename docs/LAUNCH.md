# ctxray — Launch Kit (v0.1.0)

> 这里不是 README 的复述,是**发布动作清单 + 即拷即用的传播文案**。
> 用法:按顺序执行,把 `https://github.com/yuyuyu-dev/ctxray`、`[NPM_PACKAGE]` 等占位符替换后直接发出。

---

## 0. 发布前检查(半天,一次做完)

- [ ] `git init` 后提交首个 commit(当前仓库还是零 commit 状态)。
- [ ] 建 GitHub 仓库(建议名:`ctxray`),推上去,开 `Issues` + `Discussions`。
- [ ] 跑 `npm run demo`,截图 `dist-demo/ctx-report.html` → 存为 `docs/preview.png` 并提交。
- [ ] 跑 `npx ctxray scan` 截你自己机器的真实输出(这是最好的素材)。
- [ ] 配 CI(GitHub Actions:node 20/22/24 × `npm test`)。
- [ ] `npm publish`(注意:`prepublishOnly` 已自动 build)。
- [ ] 在 README 顶部把 `git clone <repo>` 换成真实 URL。
- [ ] 核对 `pricing.ts` 价格表与当前官方价目(被质疑前先自查)。
- [ ] 确认两个 README 顶部语言选择器指向正确(机制见 `docs/i18n.md`)。

---

## 1. GitHub Release v0.1.0(标题 + body 即拷即用)

**Title**:
```
v0.1.0 — The context carbon footprint health check for your AI coding agent
```

**Body**:
```markdown
## One command: find out where your tokens — and your money — actually go

Your coding agent re-reads the same files dozens of times, fills its context with
JSON noise, loops on errors, and you pay for all of it. Nobody can tell you where.

`npx ctxray scan` reads your local Claude Code / Codex session logs (never
leaves your machine, never modified, zero network in v1) and produces:

- exact input/output/cache token totals straight from the agent's `usage` field,
- per-tool attribution (which tool burned the most tokens),
- repeated-read detection (`GameManager.tsx x41`), error-output tokens,
- a transparent Waste Score (A–F) with ranked, actionable suggestions,
- a self-contained offline HTML report you can email to your team.

`audit-config` also estimates the fixed per-turn cost of your CLAUDE.md + MCP
servers — the toll you pay on every single model call.

ccusage tells you *how much* you spent. ctxray tells you *where it went* and
*what to fix first*. They are complementary and read the same JSONL files.

Supported: Claude Code (verified against real sessions) · Codex (beta).
License: MIT. Node >= 20.

Install: `npx ctxray scan`
Docs: [README](README.md) · Demo: `npm run demo`
```

---

## 2. Show HN 帖子(英文社区首帖)

**Title 候选**:
```
Show HN: I built a health check that shows where your claude-code tokens go (npx ctxray scan)
```

**Body**:
```text
My agent and I had a problem: the monthly bill was real, but nobody could tell me
where it went. So I built a CLI that reads local Claude Code / Codex session logs
(JSONL, same files ccusage reads) and prints a full diagnosis:

    tokens    input 5.8M · output 2.0M · cache read 997.6M
    cost      $24.38 (approx, prices configurable)
    content breakdown (1.8M tokens, all same measure):
      █████████████        67.1%  tool output
      ...
    waste score 38/100 · grade B
    top issue  tool output is 67% of all content tokens
    re-reads   GameManager.tsx x41, AssetLoader.tsx x30, ...

Design constraints I liked and kept:
- totals come from the agent's own usage field — zero estimation
- attribution via a tiny zero-dep heuristic (error only affects ratios, never totals)
- 100% local, read-only, zero network in v1
- shareable single-file HTML report (no CDN, works offline)
- MIT, one runtime dependency

What surprised me most running it on my own sessions: tool output is 50-70% of
all content tokens, and files get re-read 30-40x in a single afternoon. The
compression tools everyone recommends only work once you know what's bloated.

Would love feedback, especially about the Waste Score thresholds (they're
commented and configurable) and the Codex format (beta — community-documented).

[repo] · `npx ctxray scan`
```

---

## 3. V2EX 帖子(中文社区首帖)

**Title 候选**:
```
我给自己 11 天的 Claude Code 会话做了个体检:查出 67% 的 token 都是工具噪音
```

**Body**:
```text
上个月 AI 编码账单离谱,但翻遍官方后台都只告诉你总价,不告诉你花哪了。
于是我写了个小工具,直接读本机 ~/.claude 的会话日志(JSONL),跑完是这样:

11 个会话,input 5.8M、cache read 997.6M、约 $24.38,
其中 67% 的上下文 token 是工具输出(JSON 噪音、日志全文),
一个文件被重复读了 41 次,还有 18.7K token 花在报错输出上。

几个设计选择,欢迎拍砖:
- 总额直接取每轮的 usage 字段,不做估算;
- 归因用零依赖启发式,误差只影响占比、不影响总额;
- 纯本地、只读、零网络,数据不出机器;
- 报告是单文件 HTML,离线可开、可转发给同事;
- MIT。

和 ccusage 的关系:它记账(花了多少),我诊断(花在哪、怎么先改)。
配合 headroom / context-mem 这类压缩工具用:先体检,再对症下药。

支持 Claude Code(已验证)+ Codex(beta)。
一条命令:`npx ctxray scan` → https://github.com/yuyuyu-dev/ctxray
```

---

## 4. 掘金文章提纲(长文,SEO + 收藏向)

**Title 候选**:
```
《我给 AI 编码 Agent 写了个体检工具:一张图看清 token 和钱去哪了》
```

**结构**:
```markdown
1. 引子:账单背后的困惑(你的 token 去哪了?)
2. 现象:工具噪音 / 重复读取 / 报错循环 / 配置过路费(每个配真实截图)
3. 为什么不直接上压缩工具:先诊断、后治疗,headroom 也要知道哪里臃肿
4. 技术方案:JSONL 解析 → usage 精确计量 → 启发式归因 → Waste Score → HTML 报告
   - 归因误差为什么不影响总额(设计关键点)
   - 缓存记账语义:Anthropic 式 vs deepseek 式
5. 实测结果:我 11 天的会话数据拆解(67% 工具噪音、文件读 41 次)
6. 与 ccusage / headroom / context-mem 的关系(诚实对比表)
7. 路线图:匿名排行榜、更多 Agent、连续 N 天对比
8. 开源:MIT、零依赖、欢迎提 issue
```

---

## 5. X / Twitter 首发 Thread

```text
1/ Your coding agent burns tokens all day and you have no idea where they go.
Most people guess. I made a CLI that proves it. ↓

2/ It reads your local Claude Code / Codex session logs (100% local, read-only,
zero network) and prints where every token went: tool output vs thinking vs
assistant text, plus cost, per-tool leaderboard, repeated reads, and error tokens.

3/ The reveal: in my sessions, 67% of content tokens are tool output, and the
same file gets read 30-40x in an afternoon. That's the stuff compression tools
can't fix until you know it exists.

4/ Design: totals straight from the agent's usage field (no estimation),
zero-dep attribution heuristic, transparent A-F Waste Score, single-file offline
HTML report you can email your team.

5/ It complements ccusage (accounting) and headroom/context-mem (treatment) —
diagnosis is the upstream step everyone was missing.

Claude Code: verified. Codex: beta. MIT. Try it:
npx ctxray scan

GitHub: https://github.com/yuyuyu-dev/ctxray (star if useful 🙏)
```

---

## 6. 其他可用钩子(按渠道选用)

- **Reddit r/ClaudeAI / r/LocalLLaMA**:"PSA: you can see exactly what your Claude Code spent tokens on — I open-sourced the tool I used."
- **Product Hunt**(可选):标题 "ctxray — See where your AI coding agent spends tokens";首图用真实 scan 截图;tagline 用 README 首句。
- **公众号 / 即刻 / 小红书**:直接改第 3/4 节的标题与开头,配上 `npm run demo` 生成的截图即可。
- **行业 newsletter**:一句话投稿——"ctxray: the context carbon footprint health check for Claude Code & Codex; diagnose where tokens go before you optimize."

---

## 7. 发布日历(Day 0 – Day 7)

| 时间 | 动作 | 指标 |
|---|---|---|
| Day 0 | `npm publish` + GitHub Release + Show HN + V2EX | 首 24h:一次性 star ≥ 80、npm 下载 ≥ 300 |
| Day 1 | 回复全部评论(每一条都回,尤其是批评);发 X thread + 掘金长文 | 评论区提到的竞品/Bug 列表 |
| Day 2 | 根据反馈修 1–2 个真实 issue 并发 patch(展示响应速度) | star ≥ 200 |
| Day 3–7 | 把用户真实报告截图做成 collab 墙;**发 i18n 翻译征集**(docs/i18n.md,第一波社区贡献通常是翻译);发起 Discussions 收集"典型浪费画像" | 有人主动贡献(PR/issue/翻译) |

**Debounce 规则**:任何提到"为什么不用 ccusage / X"的评论,统一用 README 的诚实对比表回应——互补不竞争,共享同一份 JSONL。

---

## 8. 如果数据不错,下一版的三个爆点(已预留接口)

1. **匿名浪费排行榜**(v2 预留了 `reportHash` 与上报 schema):"你的 Agent 在同配置里排第 23 名,比 67% 的人费" → 社交对比是最大的传播引擎。
2. **诊断 → 一键行动**:waste score 下方直接给可执行改动(精简版 CLAUDE.md、建议禁用的 MCP 清单),把"体检"升级为"体检 + 处方"。
3. **连续 N 天趋势**:优化前后的成本曲线对比图——"我上个月省了 $40" 是永远有效的第二波内容。

---

## 9. 兜底心态

爆款是概率事件,发布是能力事件。这一版的目标是:**让每个看到的人都想跑一次 `npx ctxray scan`,并且跑完愿意截图分享。** 只要做到这一条,star 和下载量只是结果。
