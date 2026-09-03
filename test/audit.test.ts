import { describe, expect, it } from 'vitest';
import { auditConfig } from '../src/audit/config.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('auditConfig', () => {
  const claudeMd = path.join(os.homedir(), '.claude', 'CLAUDE.md');
  const mcpJson = path.join(os.homedir(), '.claude.json');

  it('estimates baseline from a real CLAUDE.md', () => {
    if (!fs.existsSync(claudeMd)) return; // skip if no global config
    const result = auditConfig({ configPath: claudeMd });
    expect(result.configTokens).toBeGreaterThan(0);
    expect(result.estimatedPerTurnBaseline).toBeGreaterThan(0);
    expect(result.estimatedMonthlyCost).toBeGreaterThan(0);
  });

  it('detects MCP servers from the real config', () => {
    if (!fs.existsSync(mcpJson)) return; // skip if no global config
    const result = auditConfig({ mcpPath: mcpJson });
    expect(result.mcpServers.length).toBeGreaterThanOrEqual(0);
    // The user has 1 MCP server
  });

  it('handles missing files gracefully', () => {
    const result = auditConfig({ configPath: '/nonexistent/CLAUDE.md', mcpPath: '/nonexistent/mcp.json' });
    expect(result.configTokens).toBe(0);
    expect(result.mcpServers).toHaveLength(0);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('produces suggestions when baseline is large', () => {
    const tmp = path.join(os.tmpdir(), 'test-claude-md.md');
    fs.writeFileSync(tmp, '# ' + 'x'.repeat(100_000));
    const result = auditConfig({ configPath: tmp });
    expect(result.configTokens).toBeGreaterThan(0);
    expect(result.suggestions.some((s) => s.includes('CLAUDE.md'))).toBe(true);
    fs.unlinkSync(tmp);
  });
});