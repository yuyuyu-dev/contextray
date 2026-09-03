import type { Session } from '../sources/types.js';
import { countTokens } from './tokens.js';
import { lookupPrice, turnCost } from './pricing.js';

export interface ToolStat {
  tool: string;
  calls: number;
  resultTokens: number;
  resultChars: number;
  errorTokens: number;
}

export interface ReadRepeat {
  path: string;
  count: number;
}

export interface SessionBreakdown {
  sessionCount: number;
  turnCount: number;
  totalInput: number;
  totalOutput: number;
  totalCacheRead: number;
  totalCacheWrite: number;
  totalCost: number;
  toolResultTokens: number;
  userTextTokens: number;
  assistantTextTokens: number;
  thinkingTokens: number;
  /** Sum of the four content kinds above (same tiktoken yardstick). */
  contentTokens: number;
  errorTokens: number;
  uniqueReadTargets: number;
  tools: ToolStat[];
  repeatedReads: ReadRepeat[];
}

export function analyzeSessions(sessions: Session[]): SessionBreakdown {
  const tools = new Map<string, ToolStat>();
  const readCounts = new Map<string, number>();
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;
  let totalCost = 0;
  let toolResultTokens = 0;
  let userTextTokens = 0;
  let assistantTextTokens = 0;
  let thinkingTokens = 0;
  let errorTokens = 0;
  let turnCount = 0;

  for (const session of sessions) {
    for (const turn of session.turns) {
      turnCount += 1;
      totalInput += turn.usage.input;
      totalOutput += turn.usage.output;
      totalCacheRead += turn.usage.cacheRead;
      totalCacheWrite += turn.usage.cacheWrite;
      totalCost += turnCost(turn.usage, lookupPrice(turn.model || session.model));

      for (const block of turn.blocks) {
        switch (block.kind) {
          case 'tool-result': {
            const t = countTokens(block.text);
            toolResultTokens += t;
            if (block.isError) errorTokens += t;
            let stat = tools.get(block.tool);
            if (!stat) {
              stat = { tool: block.tool, calls: 0, resultTokens: 0, resultChars: 0, errorTokens: 0 };
              tools.set(block.tool, stat);
            }
            stat.calls += 1;
            stat.resultTokens += t;
            stat.resultChars += block.text.length;
            if (block.isError) stat.errorTokens += t;
            break;
          }
          case 'user-text': {
            const t = countTokens(block.text);
            userTextTokens += t;
            break;
          }
          case 'assistant-text':
            assistantTextTokens += countTokens(block.text);
            break;
          case 'thinking':
            thinkingTokens += countTokens(block.text);
            break;
          case 'tool-use': {
            if ((block.tool === 'Read' || block.tool === 'Grep') && typeof block.input === 'object') {
              const target = block.input.file_path ?? block.input.path;
              if (typeof target === 'string' && target) {
                readCounts.set(target, (readCounts.get(target) ?? 0) + 1);
              }
            }
            break;
          }
          case 'system':
            break;
        }
      }
    }
  }

  const repeatedReads = [...readCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count);

  return {
    sessionCount: sessions.length,
    turnCount,
    totalInput,
    totalOutput,
    totalCacheRead,
    totalCacheWrite,
    totalCost,
    toolResultTokens,
    userTextTokens,
    assistantTextTokens,
    thinkingTokens,
    contentTokens: toolResultTokens + userTextTokens + assistantTextTokens + thinkingTokens,
    errorTokens,
    uniqueReadTargets: readCounts.size,
    tools: [...tools.values()].sort((a, b) => b.resultTokens - a.resultTokens),
    repeatedReads,
  };
}
