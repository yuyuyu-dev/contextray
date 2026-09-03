import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { exec } from 'node:child_process';
import { Command } from 'commander';
import { VERSION } from './version.js';
import { analyzeSessions } from './analyze/breakdown.js';
import { detectAgent, listClaudeSessions, listCodexSessions } from './sources/detect.js';
import { parseClaudeSession } from './sources/claude.js';
import { parseCodexSession } from './sources/codex.js';
import type { AgentId, Session } from './sources/types.js';
import { defaultSnapshotPath, readSnapshot, reportHash, writeSnapshot } from './storage/snapshot.js';
import { renderSummary, renderShareCard } from './report/text.js';
import { renderHtml } from './report/html.js';
import { auditConfig } from './audit/config.js';
import { isModelPriced } from './analyze/pricing.js';

function openInBrowser(filePath: string): void {
  const cmd =
    process.platform === 'win32' ? `start "" "${filePath}"` : process.platform === 'darwin' ? `open "${filePath}"` : `xdg-open "${filePath}"`;
  exec(cmd, (err) => {
    if (err) console.log(`Report saved to ${filePath}`);
  });
}

const program = new Command();

program
  .name('contextray')
  .description('AI coding agent "context carbon footprint" diagnostic CLI')
  .version(VERSION);

function resolveAgent(agent: string, home: string): AgentId {
  if (agent === 'claude' || agent === 'codex') return agent;
  return detectAgent(home);
}

function parseSessionFile(file: string, agent: AgentId): Session {
  return agent === 'claude' ? parseClaudeSession(file) : parseCodexSession(file);
}

program
  .command('scan')
  .description('Scan local session records and output token waste breakdown')
  .option('--agent <agent>', 'agent to scan: claude | codex | auto', 'auto')
  .option('--since <days>', 'only sessions from the last N days (default 30; 0 = all time)', Number)
  .option('--project <slug>', 'only a specific project')
  .option('--json', 'output machine-readable snapshot JSON')
  .action(async (options: { agent: string; since?: number; project?: string; json?: boolean }) => {
    const home = os.homedir();
    const agent = resolveAgent(options.agent, home);
    const allFiles = agent === 'claude' ? listClaudeSessions(home) : listCodexSessions(home);

    // Default: last 30 days. `--since 0` scans all time.
    const sinceDays = options.since ?? 30;
    const cutoff = sinceDays > 0 ? Date.now() - sinceDays * 86_400_000 : 0;
    const files = cutoff
      ? allFiles.filter((file) => {
          try {
            return fs.statSync(file).mtimeMs >= cutoff;
          } catch {
            return true; // include if stat fails; let parse decide
          }
        })
      : allFiles;

    if (!options.json) {
      console.error(
        `contextray: scanning ${files.length} ${agent} session file(s)${cutoff ? ` (last ${sinceDays}d)` : ' (all time)'}…`,
      );
    }

    const t0 = Date.now();
    let failed = 0;
    const parsed: Session[] = files
      .map((file) => {
        try {
          return parseSessionFile(file, agent);
        } catch {
          failed += 1;
          return null;
        }
      })
      .filter((s): s is Session => s !== null);

    const sessions = options.project
      ? parsed.filter((s) => s.project.toLowerCase().includes(options.project!.toLowerCase()))
      : parsed;

    const breakdown = analyzeSessions(sessions);
    if (!options.json) {
      console.error(
        `contextray: parsed ${sessions.length} session(s) in ${Date.now() - t0}ms${failed ? `, ${failed} file(s) skipped` : ''}`,
      );
    }

    // Warn when a model isn't in the price table — its cost is a sonnet-default guess.
    const unknown = new Set<string>();
    for (const s of sessions) {
      for (const t of s.turns) {
        const m = t.model || s.model;
        if (m && !isModelPriced(m)) unknown.add(m);
      }
    }
    if (unknown.size > 0) {
      console.error(`contextray: model(s) not in price table, billed at default (sonnet): ${[...unknown].join(', ')}`);
    }

    if (sessions.length === 0) {
      const empty = {
        version: 1 as const,
        createdAt: new Date().toISOString(),
        agent,
        sessionCount: 0,
        reportHash: reportHash(breakdown),
        breakdown,
      };
      if (options.json) console.log(JSON.stringify(empty, null, 2));
      const where = agent === 'claude' ? '~/.claude/projects' : '~/.codex/sessions';
      console.error(`contextray: no ${agent} sessions found. Checked ${where}.`);
      console.error('Run `contextray ls-sessions` to inspect what is available.');
      process.exit(1);
    }

    const snapshot = {
      version: 1 as const,
      createdAt: new Date().toISOString(),
      agent,
      sessionCount: sessions.length,
      reportHash: reportHash(breakdown),
      breakdown,
    };

    if (options.json) {
      console.log(JSON.stringify(snapshot, null, 2));
    } else {
      writeSnapshot(snapshot, defaultSnapshotPath(home));
      console.log(renderSummary(breakdown, agent));
      const card = renderShareCard(breakdown, agent);
      if (card) console.log(card);
    }
  });

program
  .command('report')
  .description('Generate a self-contained HTML report from the latest snapshot')
  .option('--path <file>', 'output HTML path', 'ctx-report.html')
  .option('--open', 'open the report in the default browser')
  .action(async (options: { path: string; open?: boolean }) => {
    const snapshot = readSnapshot(defaultSnapshotPath(os.homedir()));
    if (!snapshot) {
      console.error('No snapshot found. Run `contextray scan` first.');
      process.exit(1);
    }
    if (snapshot.sessionCount === 0) {
      console.error('contextray: snapshot has 0 sessions. Run `contextray scan` again.');
      process.exit(1);
    }
    const out = path.resolve(options.path);
    const html = renderHtml(snapshot.breakdown, snapshot.agent, snapshot.createdAt);
    const fs = await import('node:fs');
    fs.writeFileSync(out, html);
    console.log(`Report written to ${out}`);
    if (options.open) openInBrowser(out);
  });

program
  .command('audit-config')
  .description('Static cost estimate of CLAUDE.md / MCP configs')
  .option('--config <file>', 'path to CLAUDE.md or agent config')
  .option('--mcp <file>', 'path to MCP config JSON')
  .option('--model <model>', 'model name for pricing', 'default')
  .action(async (options: { config?: string; mcp?: string; model?: string }) => {
    const home = os.homedir();
    const configPath = options.config ?? path.join(home, '.claude', 'CLAUDE.md');
    const mcpPath = options.mcp ?? path.join(home, '.claude.json');
    const result = auditConfig({ configPath, mcpPath, model: options.model });
    if (options.model && options.model !== 'default' && !isModelPriced(options.model)) {
      console.error(`contextray: model '${options.model}' not in price table, assuming sonnet pricing.`);
    }

    const lines: string[] = [];
    lines.push(`ContextRay · config audit`);
    lines.push('─'.repeat(48));
    lines.push(`CLAUDE.md           ${result.configTokens.toLocaleString()} tokens (${result.configFilePath ? result.configFilePath : 'not found'})`);
    if (result.mcpServers.length > 0) {
      lines.push(`MCP servers         ${result.mcpServers.length}`);
      for (const s of result.mcpServers) {
        lines.push(`  - ${s.name}  ~${(s.estimatedSchemaTokens / 1000).toFixed(1)}K tokens`);
      }
    } else {
      lines.push(`MCP servers         none`);
    }
    lines.push(`per-turn baseline   ${(result.estimatedPerTurnBaseline / 1000).toFixed(1)}K tokens (system+tools)`);
    lines.push(`est. monthly cost   $${result.estimatedMonthlyCost.toFixed(2)} (assumes 200 turns/session, 30 sessions/month)`);
    lines.push('');
    lines.push('suggestions');
    if (result.suggestions.length === 0) lines.push('  - none');
    result.suggestions.forEach((s) => lines.push(`  - ${s}`));
    console.log(lines.join('\n'));
  });

program
  .command('ls-sessions')
  .description('List local sessions available to scan')
  .option('--agent <agent>', 'agent to list: claude | codex', 'auto')
  .option('--since <days>', 'only sessions from the last N days', Number)
  .action(async (options: { agent: string; since?: number }) => {
    const home = os.homedir();
    const agent = resolveAgent(options.agent, home);
    const files = agent === 'claude' ? listClaudeSessions(home) : listCodexSessions(home);
    const since = options.since ?? 14;
    const cutoff = Date.now() - since * 86_400_000;
    const recent = files
      .map((file) => {
        try {
          return parseSessionFile(file, agent);
        } catch {
          return null;
        }
      })
      .filter((s): s is Session => s !== null && s.firstTs >= cutoff)
      .sort((a, b) => b.firstTs - a.firstTs);

    console.log(`Found ${recent.length} recent sessions (${agent}, last ${since} days)`);
    for (const s of recent.slice(0, 20)) {
      const turns = s.turns.length;
      const input = s.turns.reduce((acc, t) => acc + t.usage.input, 0);
      const date = new Date(s.firstTs).toISOString().slice(0, 10);
      console.log(`  ${date}  ${s.project.padEnd(28, ' ')} ${turns.toString().padStart(4)} turns  ${(input / 1e3).toFixed(0)}K input`);
    }
  });

await program.parseAsync(process.argv);
