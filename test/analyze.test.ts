import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { parseClaudeSession } from '../src/sources/claude.js';
import { parseCodexSession } from '../src/sources/codex.js';
import { analyzeSessions } from '../src/analyze/breakdown.js';
import { wasteScore } from '../src/analyze/wastescore.js';
import { countTokens } from '../src/analyze/tokens.js';
import { lookupPrice, turnCost } from '../src/analyze/pricing.js';

const claudeFixture = fileURLToPath(new URL('./fixtures/claude-sample.jsonl', import.meta.url));
const codexFixture = fileURLToPath(new URL('./fixtures/codex-sample.jsonl', import.meta.url));

describe('countTokens', () => {
  it('counts non-zero tokens for text', () => {
    expect(countTokens('hello world')).toBeGreaterThan(0);
    expect(countTokens('')).toBe(0);
  });
});

describe('pricing', () => {
  it('matches model families', () => {
    expect(lookupPrice('claude-sonnet-4-5').inputPerM).toBe(3);
    expect(lookupPrice('gpt-5-codex').inputPerM).toBe(1.25);
    expect(lookupPrice('unknown-model').inputPerM).toBe(3); // sonnet default
  });

  it('computes cost with cached tokens billed at cache rate', () => {
    const price = lookupPrice('claude-sonnet-4-5');
    const cost = turnCost({ input: 1000, output: 500, cacheRead: 600, cacheWrite: 0 }, price);
    // fresh 400 @ $3/M + cached 600 @ $0.3/M + output 500 @ $15/M
    expect(cost).toBeCloseTo(400 / 1e6 * 3 + 600 / 1e6 * 0.3 + 500 / 1e6 * 15, 6);
  });

  it('bills cache additively for deepseek-style providers (cache can exceed input)', () => {
    const price = lookupPrice('deepseek-v4-pro');
    expect(price.cacheIsAdditive).toBe(true);
    const cost = turnCost({ input: 1000, output: 500, cacheRead: 1500, cacheWrite: 0 }, price);
    // fresh 1000 @ $0.27/M + cached 1500 @ $0.014/M + output 500 @ $1.1/M
    expect(cost).toBeCloseTo(1000 / 1e6 * 0.27 + 1500 / 1e6 * 0.014 + 500 / 1e6 * 1.1, 6);
  });
});

describe('analyzeSessions', () => {
  const claude = parseClaudeSession(claudeFixture, { project: 'demo' });
  const codex = parseCodexSession(codexFixture, { project: 'acme' });

  it('aggregates exact token totals', () => {
    const bd = analyzeSessions([claude]);
    expect(bd.sessionCount).toBe(1);
    expect(bd.turnCount).toBe(3);
    expect(bd.totalInput).toBe(1200 + 1800 + 1900);
    expect(bd.totalOutput).toBe(30 + 15 + 10);
  });

  it('attributes tool output per tool and tracks errors', () => {
    const bd = analyzeSessions([claude]);
    const read = bd.tools.find((t) => t.tool === 'Read');
    expect(read?.calls).toBe(2);
    expect(read?.resultChars).toBeGreaterThan(0);
    expect(bd.errorTokens).toBeGreaterThan(0);
    expect(bd.toolResultTokens).toBeGreaterThan(0);
  });

  it('computes content tokens as the sum of all content kinds', () => {
    const bd = analyzeSessions([claude]);
    expect(bd.contentTokens).toBe(bd.toolResultTokens + bd.userTextTokens + bd.assistantTextTokens + bd.thinkingTokens);
    expect(bd.contentTokens).toBeGreaterThan(0);
  });

  it('handles empty session lists', () => {
    const bd = analyzeSessions([]);
    expect(bd.sessionCount).toBe(0);
    expect(bd.contentTokens).toBe(0);
    expect(bd.totalCost).toBe(0);
  });

  it('aggregates across both agents', () => {
    const bd = analyzeSessions([claude, codex]);
    expect(bd.sessionCount).toBe(2);
    expect(bd.turnCount).toBe(6);
  });
});

describe('wasteScore', () => {
  it('produces a bounded score, grade, and suggestions', () => {
    const bd = analyzeSessions([parseClaudeSession(claudeFixture, { project: 'demo' })]);
    const ws = wasteScore(bd);
    expect(ws.score).toBeGreaterThanOrEqual(0);
    expect(ws.score).toBeLessThanOrEqual(100);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(ws.grade);
    expect(ws.suggestions.length).toBeGreaterThan(0);
    expect(ws.topIssue.length).toBeGreaterThan(0);
  });
});
