import type { SessionBreakdown } from '../analyze/breakdown.js';
import { wasteScore } from '../analyze/wastescore.js';
import type { AgentId } from '../sources/types.js';
import { donutChart } from './chart.js';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

const GRADES: Record<string, string> = { A: '#16a34a', B: '#84cc16', C: '#f59e0b', D: '#f97316', F: '#ef4444' };

function gradeBadge(grade: string): string {
  const color = GRADES[grade] ?? '#18181b';
  return `<span style="display:inline-block;padding:2px 14px;border-radius:999px;background:${color};color:#fff;font-weight:700;font-size:22px">${grade}</span>`;
}

function toolBars(tools: SessionBreakdown['tools']): string {
  const max = tools.length > 0 ? tools[0].resultTokens : 1;
  return tools
    .slice(0, 8)
    .map((t) => {
      const w = Math.max(1, Math.round((t.resultTokens / max) * 100));
      return `<div class="tool-row">
        <span class="tool-name" title="${escapeHtml(t.tool)}">${escapeHtml(t.tool)}</span>
        <div class="tool-track"><div class="tool-fill" style="width:${w}%"></div></div>
        <span class="tool-val">${fmt(t.resultTokens)}${t.calls > 1 ? ` (${t.calls} calls)` : ''}</span>
      </div>`;
    })
    .join('');
}

function readList(repeatedReads: SessionBreakdown['repeatedReads']): string {
  if (repeatedReads.length === 0) {
    return '<p class="muted">No files were read more than once.</p>';
  }
  return repeatedReads
    .slice(0, 8)
    .map((r) => `<li><span class="muted">x${r.count}</span> <code>${escapeHtml(r.path)}</code></li>`)
    .join('');
}

export function renderHtml(bd: SessionBreakdown, agent: AgentId, createdAt: string): string {
  const ws = wasteScore(bd);
  const content = bd.contentTokens || 1;
  const segments = [
    { label: 'tool output', value: bd.toolResultTokens, color: '#e11d48' },
    { label: 'assistant text', value: bd.assistantTextTokens, color: '#6366f1' },
    { label: 'user text', value: bd.userTextTokens, color: '#10b981' },
    { label: 'thinking', value: bd.thinkingTokens, color: '#f59e0b' },
  ];

  const legend = segments
    .map(
      (s) => `<div class="legend-item"><span class="dot" style="background:${s.color}"></span>${s.label} <strong>${pct(s.value / content)}</strong></div>`,
    )
    .join('');

  const suggestions = ws.suggestions.map((s) => `<li>${escapeHtml(s)}</li>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>CtxRay Report</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 0; background: #fafafa; color: #18181b; }
  .wrap { max-width: 860px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  .sub { color: #71717a; margin-bottom: 24px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 28px; }
  .card { background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 14px 16px; }
  .card .k { font-size: 12px; color: #71717a; text-transform: uppercase; letter-spacing: .04em; }
  .card .v { font-size: 20px; font-weight: 700; margin-top: 4px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 700px) { .grid2 { grid-template-columns: 1fr; } }
  .panel { background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 18px; margin-bottom: 12px; }
  .panel h2 { font-size: 15px; margin: 0 0 14px; }
  .donut-wrap { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
  .legend { display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
  .legend-item { display: flex; align-items: center; gap: 8px; }
  .dot { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
  .tool-row { display: grid; grid-template-columns: 160px 1fr 110px; gap: 10px; align-items: center; margin-bottom: 8px; font-size: 13px; }
  .tool-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #52525b; }
  .tool-track { background: #f4f4f5; border-radius: 6px; height: 12px; overflow: hidden; }
  .tool-fill { background: #e11d48; height: 100%; border-radius: 6px; }
  .tool-val { text-align: right; color: #52525b; }
  ul.reads, ul.sugg { margin: 0; padding-left: 18px; font-size: 14px; line-height: 1.9; }
  code { background: #f4f4f5; padding: 1px 6px; border-radius: 5px; font-size: 13px; }
  .muted { color: #71717a; }
  .score-line { font-size: 16px; margin: 10px 0 0; }
  .foot { margin-top: 28px; color: #a1a1aa; font-size: 12px; line-height: 1.7; }
</style>
</head>
<body>
<div class="wrap">
  <h1>CtxRay Report</h1>
  <div class="sub">${agent === 'claude' ? 'Claude Code' : 'Codex'} · ${bd.sessionCount} sessions · ${escapeHtml(createdAt)}</div>

  <div class="cards">
    <div class="card"><div class="k">input tokens</div><div class="v">${fmt(bd.totalInput)}</div></div>
    <div class="card"><div class="k">output tokens</div><div class="v">${fmt(bd.totalOutput)}</div></div>
    <div class="card"><div class="k">cache read</div><div class="v">${fmt(bd.totalCacheRead)}</div></div>
    <div class="card"><div class="k">est. cost</div><div class="v">$${bd.totalCost.toFixed(2)}</div></div>
    <div class="card"><div class="k">waste score</div><div class="v">${ws.score}/100 ${gradeBadge(ws.grade)}</div></div>
  </div>

  <div class="grid2">
    <div class="panel">
      <h2>Content breakdown</h2>
      <div class="donut-wrap">
        ${donutChart(segments, { centerLabel: `${ws.score}`, centerSub: 'waste' })}
        <div class="legend">${legend}</div>
      </div>
      <p class="score-line">Top issue: <strong>${escapeHtml(ws.topIssue)}</strong></p>
    </div>
    <div class="panel">
      <h2>Where the money goes</h2>
      <p class="muted" style="font-size:13px">Tool output is the largest bucket of content. Reducing it has the biggest lever on both tokens and cost.</p>
      ${bd.toolResultTokens > 0 ? toolBars(bd.tools) : '<p class="muted">No tool output captured.</p>'}
    </div>
  </div>

  <div class="grid2">
    <div class="panel">
      <h2>Repeated reads</h2>
      <ul class="reads">${readList(bd.repeatedReads)}</ul>
    </div>
    <div class="panel">
      <h2>Suggestions</h2>
      <ul class="sugg">${suggestions}</ul>
    </div>
  </div>

  <div class="foot">
    Generated by <strong>ctxray</strong> · error output ${fmt(bd.errorTokens)} tokens ·<br/>
    This report is generated locally. No data leaves your machine.
  </div>
</div>
</body>
</html>`;
}
