import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isModelPriced } from '../src/analyze/pricing.js';
import { analyzeSessions } from '../src/analyze/breakdown.js';
import { wasteScore } from '../src/analyze/wastescore.js';
import { renderSummary } from '../src/report/text.js';
import { auditConfig } from '../src/audit/config.js';

describe('isModelPriced', () => {
  it('returns true for known model families', () => {
    expect(isModelPriced('claude-sonnet-4-5')).toBe(true);
    expect(isModelPriced('gpt-5-codex')).toBe(true);
    expect(isModelPriced('deepseek-v4-pro')).toBe(true);
  });

  it('returns false for unknown models', () => {
    expect(isModelPriced('my-fine-tuned-llama')).toBe(false);
    expect(isModelPriced('default')).toBe(false);
  });
});

describe('renderSummary empty-data guard', () => {
  it('returns a clear message instead of a misleading grade on zero data', () => {
    const bd = analyzeSessions([]);
    const out = renderSummary(bd, 'claude');
    expect(out).toContain('no session data');
    expect(out).not.toContain('grade');
    // wasteScore on empty still bounded, but summary must not expose it
  });

  it('still renders normally when there is data', () => {
    const bd = analyzeSessions([]);
    bd.totalInput = 1000;
    bd.contentTokens = 100;
    bd.toolResultTokens = 60;
    bd.userTextTokens = 40;
    const out = renderSummary(bd, 'claude');
    expect(out).toContain('CtxRay');
    expect(out).toContain('grade');
  });
});

describe('auditConfig resilience', () => {
  it('does not crash on a corrupt MCP config and reports the issue', () => {
    const dir = path.join(os.tmpdir(), `ctxray-mcp-${Date.now()}`);
    fs.mkdirSync(dir, { recursive: true });
    const mcp = path.join(dir, 'bad.json');
    fs.writeFileSync(mcp, '{ this is not valid json');
    const result = auditConfig({ mcpPath: mcp, model: 'default' });
    expect(result.mcpServers).toHaveLength(0);
    expect(result.mcpFilePath).toBeNull();
    expect(result.suggestions.some((s) => s.includes('not valid JSON'))).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('parses a valid MCP config normally', () => {
    const dir = path.join(os.tmpdir(), `ctxray-mcp2-${Date.now()}`);
    fs.mkdirSync(dir, { recursive: true });
    const mcp = path.join(dir, 'good.json');
    fs.writeFileSync(mcp, JSON.stringify({ mcpServers: { a: {}, b: {}, c: {} } }));
    const result = auditConfig({ mcpPath: mcp, model: 'default' });
    expect(result.mcpServers).toHaveLength(3);
    expect(result.mcpFilePath).toBe(mcp);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

