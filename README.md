<div align="center">

# contextray

**The "context carbon footprint" health check for your AI coding agent.**

One command answers the question your billing page can't:
**where did my tokens — and my money — actually go?**

`npx contextray scan` → find the waste. `npx contextray report --open` → prove it to your team.

🌍 **Language**: [🇺🇸 English](README.md) · [🇨🇳 简体中文](README.zh-CN.md) · [➕ help translate](docs/i18n.md)

![CI](https://github.com/yuyuyu-dev/contextray/actions/workflows/ci.yml/badge.svg) ![npm](https://img.shields.io/npm/v/contextray) ![License](https://img.shields.io/npm/l/contextray) ![Node](https://img.shields.io/badge/node-%3E%3D20-339933) ![Zero network](https://img.shields.io/badge/privacy-100%25%20local-10b981)

</div>

---

## The 15-second pitch

Your coding agent burns tokens every day. Point it at your repo, and by lunch it has:

- re-read the same files **dozens of times** (full file, every single time),
- flooded the context with **JSON dumps and raw tool output** the model never needed,
- looped on **the same error** until the bill got interesting,
- and paid a **per-turn toll for every MCP server and CLAUDE.md rule** you configured.

You feel it in the lag. You see it in the bill. But nobody can tell you *where* it goes.

> Compression tools (headroom, context-mem...) fix waste **after** it happens.
> **contextray shows you where the waste is *first*** — it's the checkup that tells you
> which treatment you actually need.

## See it for yourself

Real output from my own machine (23 Claude Code sessions, last 30 days):

```text
ContextRay · Claude Code · 23 sessions
────────────────────────────────────────────────
tokens    input 18.1M · output 4.3M · cache read 1.45B
cost      $31.64 (approx, prices configurable)

content breakdown (1.5M tokens, all same measure):
  ███████              32.5%  tool output
  ██                   10.7%  assistant text
  █                     2.5%  user text
  ███████████          54.2%  thinking
  error output   9.5K tokens in error results

waste score 20/100 · grade B
top issue  tool output is 33% of all content tokens
re-reads   one doc x30, one util file x8, ...
top tools  Read 296.9K, Bash 113.4K, WebSearch 28.4K

suggestions
  - Reduce tool output: truncate large JSON results, or summarize inside the tool itself.
  - Same files read repeatedly: use a code-index (MCP) instead of raw reads.
```

Thinking is the biggest raw share here (54%), but it isn't automatically waste — the score ranks **avoidable** noise first (tool output, repeated reads, errors). Run `npx contextray scan` on your own sessions to see yours — the numbers are read straight from your local Claude Code / Codex logs, never guessed.

A real scan (23 Claude Code sessions) as an HTML report — self-contained, offline, shareable:

<p align="center"><img src="docs/preview.png" alt="ContextRay HTML report preview" width="720"></p>

## Quick start

```bash
# 1. See where your tokens and money went (last 14 days):
npx contextray scan

# 2. Generate a shareable, offline HTML report and open it:
npx contextray report --open
```

That's it. It reads session files **locally** — no signup, no telemetry, no network.

Want a demo before touching your own data?
```bash
git clone https://github.com/yuyuyu-dev/contextray && npm install && npm run demo
# → writes dist-demo/ctx-report.html from synthetic fixtures
```

## What it finds — and what to do about it

| Waste it detects | Why it hurts | What it tells you |
|---|---|---|
| **Tool noise** | JSON dumps, logs and search output crowd out real reasoning | % of every content token spent on tool output, plus a per-tool leaderboard (`Read` vs `Bash` vs MCP) |
| **Repeated reads** | The same file re-enters context at full price, every turn | The exact files and how many times (`GameManager.tsx x41`) |
| **Error loops** | Failed commands burn tokens and produce nothing | How many tokens went into error results |
| **Config bloat** | Every CLAUDE.md line + MCP server is a per-turn toll | `audit-config`: per-turn baseline + estimated monthly cost + a fix list |
| **Weak caching** | Cache misses mean paying full price for the same prefix | Cache read ratio rolled into your Waste Score |
| **The big picture** | You have no monthly report card | A **Waste Score (A–F)** plus the single biggest issue to fix first |

## Commands

| Command | What it does |
|---|---|
| `scan` | Read local sessions, break down tokens & cost, write a snapshot. Flags: `--agent claude\|codex\|auto`, `--since N`, `--project <slug>`, `--json` |
| `report` | Self-contained offline HTML report from the last snapshot. Flags: `--path <file>`, `--open` |
| `audit-config` | Estimate the fixed per-turn cost of CLAUDE.md + MCP servers, with suggestions |
| `ls-sessions` | List what's available to scan: dates, projects, turns, input tokens |

## The shareable report

`contextray report` produces a **single HTML file** with everything inline:

- total cards (input / output / cache / cost / Waste Score with grade badge),
- content breakdown donut + top money-burning tools (bar chart),
- repeated-reads list, error output, and ranked suggestions,
- **zero CDN, zero external requests** — email it, attach it to the ticket, open it on an airplane.

Footer on every report: *"This report is generated locally. No data leaves your machine."*

## Why another tool? (The honest version)

| Tool | What it does | Where it leaves you |
|---|---|---|
| **ccusage** | Totals & charts of what you *spent* (accounting) | "Okay, it's a lot — now what?" |
| **headroom / context-mem** | Compress context to *spend less* (treatment) | Works only if you already know what's bloated |
| **contextray** | Shows where the waste *is*, scores it, and points at the first fix (diagnosis) | "Aha — 67% tool output, these 3 tools, this file read 41 times." |

contextray and ccusage are **complementary**: ccusage answers *"how much"*, contextray answers *"where and why"*. They can even share the same JSONL source files. The diagnostic is the upstream entry for every other optimization tool in your stack.

Still not convinced? Three more differentiators:

- **Verifiable numbers** — per-turn totals come from the agent's own `usage` field, not estimates.
- **Multi-agent by design** — Claude Code (verified against real sessions) and Codex (beta) under one report; more agents on the roadmap.
- **Read-only & local-first** — it never intercepts, rewrites, proxies or uploads your data.

## How it works

1. **Exact totals** — each turn's input / output / cache tokens come straight from the agent's `usage` field. Nothing is estimated.
2. **Attribution** — a tiny zero-dependency heuristic assigns component ratios (tool output / user text / assistant text / thinking); approximation error is absorbed into ratios, never into totals.
3. **Cost** — built-in model price table (configurable) with correct cache-accounting semantics per model family (Anthropic-style vs deepseek-style additive).
4. **Waste Score** — a transparent, weighted A–F grade across tool noise, repeated reads, invalid output and cache utilization, with ranked suggestions.
5. **Config audit** — static estimate of CLAUDE.md + MCP per-turn baseline and monthly cost.

## Supported agents

| Agent | Status |
|---|---|
| Claude Code | ✅ Verified against real sessions |
| Codex | 🧪 Community-documented rollout format; please open an issue if a format fails |
| Gemini CLI, Cursor, ... | 🚧 Roadmap |

## Privacy & trust

- **Read-only**: touches `~/.claude` and `~/.codex` only, never modifies a session file.
- **100% offline**: zero network requests in v1. The report is a self-contained file.
- **Data-minimized**: snapshots store aggregates, never your code or prompts. A `reportHash` field is ready for opt-in anonymous summaries (v2).

## Development

```bash
npm install
npm run dev -- scan      # run in dev mode
npm run demo             # demo report from synthetic fixtures
npm test                 # vitest (39 tests)
npm run build
```

## License

MIT — free to use, fork, and ship.

