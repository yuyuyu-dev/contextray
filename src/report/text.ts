import type { SessionBreakdown } from '../analyze/breakdown.js';
import { wasteScore } from '../analyze/wastescore.js';
import type { WasteResult } from '../analyze/wastescore.js';
import type { AgentId } from '../sources/types.js';

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

function bar(ratio: number, width = 20): string {
  const filled = Math.round(clamp(ratio, 0, 1) * width);
  return '█'.repeat(filled) + ' '.repeat(width - filled);
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function fmt(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

export function renderSummary(bd: SessionBreakdown, agent: AgentId): string {
  if (bd.totalInput === 0 && bd.contentTokens === 0) {
    return 'CtxRay · no session data to analyze\nRun `ctxray ls-sessions` to confirm sessions exist, then `ctxray scan`.';
  }
  const content = bd.contentTokens || 1;
  const ws = wasteScore(bd);

  const lines: string[] = [];
  lines.push(`CtxRay · ${agent === 'claude' ? 'Claude Code' : 'Codex'} · ${bd.sessionCount} sessions`);
  lines.push('─'.repeat(48));
  lines.push(`tokens    input ${fmt(bd.totalInput)} · output ${fmt(bd.totalOutput)} · cache read ${fmt(bd.totalCacheRead)}`);
  lines.push(`cost      $${bd.totalCost.toFixed(2)} (approx, prices configurable)`);
  lines.push('');
  lines.push(`content breakdown (${fmt(bd.contentTokens)} tokens, all same measure):`);
  lines.push(`  ${bar(bd.toolResultTokens / content)} ${pct(bd.toolResultTokens / content)}  tool output`);
  lines.push(`  ${bar(bd.assistantTextTokens / content)} ${pct(bd.assistantTextTokens / content)}  assistant text`);
  lines.push(`  ${bar(bd.userTextTokens / content)} ${pct(bd.userTextTokens / content)}  user text`);
  lines.push(`  ${bar(bd.thinkingTokens / content)} ${pct(bd.thinkingTokens / content)}  thinking`);
  lines.push(`  error output   ${fmt(bd.errorTokens)} tokens in error results`);
  lines.push('');
  lines.push(`waste score ${ws.score}/100 · grade ${ws.grade}`);
  lines.push(`top issue  ${ws.topIssue}`);
  if (bd.repeatedReads.length > 0) {
    lines.push(
      `re-reads   ${bd.repeatedReads
        .slice(0, 3)
        .map((r) => `${r.path}x${r.count}`)
        .join(', ')}`,
    );
  }
  if (bd.tools.length > 0) {
    lines.push(
      `top tools  ${bd.tools
        .slice(0, 3)
        .map((t) => `${t.tool} ${fmt(t.resultTokens)}`)
        .join(', ')}`,
    );
  }
  lines.push('');
  lines.push('suggestions');
  ws.suggestions.forEach((s) => lines.push(`  - ${s}`));
  return lines.join('\n');
}

const GRADE_EMOJI: Record<WasteResult['grade'], string> = {
  A: '🟢',
  B: '🟢',
  C: '🟡',
  D: '🟠',
  F: '🔴',
};

export function renderShareCard(bd: SessionBreakdown, agent: AgentId): string {
  if (bd.totalInput === 0 && bd.contentTokens === 0) return '';
  const ws = wasteScore(bd);
  const lines: string[] = [];
  lines.push('');
  lines.push('─── copy & share your checkup ───');
  lines.push(`🩻 CtxRay · ${agent === 'claude' ? 'Claude Code' : 'Codex'}`);
  lines.push(`${GRADE_EMOJI[ws.grade]} waste score ${ws.score}/100 · grade ${ws.grade}`);
  lines.push(`top issue: ${ws.topIssue}`);
  lines.push(`$${bd.totalCost.toFixed(2)} · ${bd.sessionCount} sessions · ${fmt(bd.totalCacheRead)} cache read`);
  lines.push('→ npx ctxray scan');
  return lines.join('\n');
}
