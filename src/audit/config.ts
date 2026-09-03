import fs from 'node:fs';
import { countTokens } from '../analyze/tokens.js';
import { lookupPrice } from '../analyze/pricing.js';

export interface AuditResult {
  configTokens: number;
  mcpServers: Array<{ name: string; estimatedSchemaTokens: number }>;
  estimatedPerTurnBaseline: number;
  estimatedMonthlyCost: number;
  configFilePath: string | null;
  mcpFilePath: string | null;
  suggestions: string[];
}

interface MCPConfig {
  mcpServers?: Record<string, { command?: string; url?: string; args?: string[] }>;
}

const AVG_TOOL_SCHEMA_TOKENS = 5000;

export function auditConfig(opts: { configPath?: string; mcpPath?: string; model?: string }): AuditResult {
  let configTokens = 0;
  let configFilePath = null as string | null;
  const suggestions: string[] = [];

  if (opts.configPath && fs.existsSync(opts.configPath)) {
    const text = fs.readFileSync(opts.configPath, 'utf-8');
    configTokens = countTokens(text);
    configFilePath = opts.configPath;
  }

  const mcpServers: AuditResult['mcpServers'] = [];
  let mcpFilePath = null as string | null;

  if (opts.mcpPath && fs.existsSync(opts.mcpPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(opts.mcpPath, 'utf-8')) as MCPConfig;
      if (raw.mcpServers) {
        for (const name of Object.keys(raw.mcpServers)) {
          mcpServers.push({ name, estimatedSchemaTokens: AVG_TOOL_SCHEMA_TOKENS });
        }
      }
      mcpFilePath = opts.mcpPath;
    } catch {
      mcpFilePath = null;
      suggestions.push(`MCP config at ${opts.mcpPath} is not valid JSON — skipped MCP audit.`);
    }
  }

  const mcpTokens = mcpServers.reduce((acc, s) => acc + s.estimatedSchemaTokens, 0);
  const perTurnBaseline = configTokens + mcpTokens;
  const price = lookupPrice(opts.model ?? 'default');
  const baselineCostPerTurn = price.cacheIsAdditive
    ? (perTurnBaseline / 1_000_000) * price.inputPerM
    : (perTurnBaseline / 1_000_000) * price.inputPerM;
  // Estimate: 200 turns/session, 30 sessions/month → 6000 turns/month
  const estimatedMonthlyCost = baselineCostPerTurn * 6000;

  if (opts.configPath && !fs.existsSync(opts.configPath)) {
    suggestions.push(`Config file not found: ${opts.configPath}`);
  }
  if (opts.mcpPath && !fs.existsSync(opts.mcpPath)) {
    suggestions.push(`MCP config not found: ${opts.mcpPath}`);
  }
  if (!opts.configPath && mcpServers.length === 0) {
    suggestions.push('No config file specified. Pass --config <CLAUDE.md> and --mcp <mcp.json> for a full estimate.');
  }
  if (configTokens > 20_000) {
    suggestions.push(`CLAUDE.md is ${configTokens.toLocaleString()} tokens. Consider trimming boilerplate to reduce baseline.`);
  }
  if (mcpServers.length > 3) {
    suggestions.push(`You have ${mcpServers.length} MCP servers. Each adds ~5K tokens to the baseline. Remove unused servers.`);
  }
  if (perTurnBaseline > 50_000) {
    suggestions.push(`Per-turn baseline is ${(perTurnBaseline / 1000).toFixed(0)}K tokens. This is the fixed cost of every model call.`);
  }

  return {
    configTokens,
    mcpServers,
    estimatedPerTurnBaseline: perTurnBaseline,
    estimatedMonthlyCost,
    configFilePath,
    mcpFilePath,
    suggestions,
  };
}