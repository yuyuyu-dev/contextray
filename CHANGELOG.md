# Changelog

All notable changes to **ctxray** are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-14

### Added

- `scan` — read local Claude Code / Codex session logs and break down token usage & cost:
  - exact per-turn totals straight from the agent's `usage` field (zero estimation),
  - component attribution (tool output / user text / assistant text / thinking) via a zero-dependency heuristic,
  - per-tool token leaderboard, repeated-read detection, error-output tokens,
  - transparent **Waste Score (A–F)** with ranked suggestions,
  - filters: `--agent claude|codex|auto`, `--since N`, `--project <slug>`, `--json`.

- `report` — self-contained, offline HTML report (inline SVG charts, zero CDN) from the last snapshot; flags `--path` / `--open`.
- `audit-config` — static cost estimate of CLAUDE.md + MCP servers: per-turn baseline, estimated monthly cost, fix list.
- `ls-sessions` — preview local sessions: date, project, turns, input tokens.
- `demo` — generate a demo report from synthetic fixtures (`npm run demo` → `dist-demo/ctx-report.html`), no real data required.

### Supported agents

- Claude Code — verified against real sessions.
- Codex — based on the community-documented rollout format (beta; defense-in-depth parsing).

### Changelog housekeeping

- Runtime dependency footprint: `commander` only.
- MIT license, Node >= 20.

[0.1.0]: https://github.com/yuyuyu-dev/ctxray/releases/tag/v0.1.0

