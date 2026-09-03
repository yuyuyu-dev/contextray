import fs from 'node:fs';
import path from 'node:path';
import type { Block, ParseOptions, Session, TurnUsage } from './types.js';

// The Codex CLI rollout format is community-documented and evolving; this parser
// targets the envelope format (>= 2025-09). Legacy bare-item files are handled
// defensively (best-effort) and unknown payload types are skipped.
interface Envelope {
  timestamp?: string;
  type?: string;
  payload?: Record<string, unknown> & {
    type?: string;
    id?: string;
    cwd?: string;
    model?: string;
    model_config?: { model?: string };
    call_id?: string;
    name?: string;
    arguments?: string;
    output?: string;
    role?: string;
    content?: Array<{ type?: string; text?: string }>;
    summary?: string;
    info?: {
      last_token_usage?: { input_tokens?: number; cached_input_tokens?: number; output_tokens?: number };
      total_token_usage?: { input_tokens?: number; cached_input_tokens?: number; output_tokens?: number };
    };
  };
}

function readEnvelopes(filePath: string): Envelope[] {
  const text = fs.readFileSync(filePath, 'utf-8');
  const envelopes: Envelope[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let record: Record<string, unknown>;
    try {
      record = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (record.payload && typeof record.payload === 'object') {
      envelopes.push(record as Envelope);
    } else if (typeof record.type === 'string') {
      // Bare response item (legacy format): type already describes the payload.
      envelopes.push({ timestamp: record.timestamp as string, type: 'response_item', payload: record });
    } else if (typeof record.id === 'string' || typeof record.cwd === 'string') {
      // Bare session meta (oldest format).
      envelopes.push({ type: 'session_meta', payload: record });
    }
  }
  return envelopes;
}

function extractModel(payload: Envelope['payload']): string | null {
  if (!payload) return null;
  if (typeof payload.model === 'string') return payload.model;
  const mc = payload.model_config;
  if (mc && typeof mc.model === 'string') return mc.model;
  return null;
}

function usageFromLastTokenCount(payload: Envelope['payload']): TurnUsage | null {
  const last = payload?.info?.last_token_usage;
  if (!last || typeof last.input_tokens !== 'number') return null;
  return {
    input: last.input_tokens,
    output: last.output_tokens ?? 0,
    cacheRead: last.cached_input_tokens ?? 0,
    cacheWrite: 0,
  };
}

function textBlocks(content: Array<{ type?: string; text?: string }>, kind: 'user-text' | 'assistant-text'): Block[] {
  if (!Array.isArray(content)) return [];
  const blocks: Block[] = [];
  for (const item of content) {
    if (typeof item === 'object' && item !== null && typeof item.text === 'string') {
      blocks.push({ kind, text: item.text });
    }
  }
  return blocks;
}

function parseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function outputIsError(output: string | undefined): boolean {
  if (!output) return false;
  try {
    const parsed = JSON.parse(output) as { metadata?: { exit_code?: number } };
    const code = parsed?.metadata?.exit_code;
    return code !== undefined && code !== 0;
  } catch {
    return false;
  }
}

export function parseCodexSession(filePath: string, opts: ParseOptions = {}): Session {
  const envelopes = readEnvelopes(filePath);
  let id = opts.project ? '' : path.basename(filePath, '.jsonl');
  let project = opts.project ?? '';
  let model = '';
  let firstTs = 0;
  const turns: Array<{ seq: number; model: string; usage: TurnUsage; blocks: Block[] }> = [];
  let pendingInput: Block[] = [];
  let output: Block[] = [];
  const callNames = new Map<string, string>();
  let prevTotal: { input: number; output: number; cached: number } | null = null;

  const pushTurn = (usage: TurnUsage) => {
    turns.push({ seq: turns.length, model, usage, blocks: [...pendingInput, ...output] });
    pendingInput = [];
    output = [];
  };

  for (const { type, payload, timestamp } of envelopes) {
    const ts = timestamp ? Date.parse(timestamp) || 0 : 0;
    if (!firstTs && ts) firstTs = ts;

    if (type === 'session_meta' && payload) {
      if (!id && typeof payload.id === 'string') id = payload.id;
      if (!project && typeof payload.cwd === 'string') project = path.basename(payload.cwd);
      if (!firstTs && typeof payload.timestamp === 'string') firstTs = Date.parse(payload.timestamp) || 0;
      continue;
    }

    if (type === 'turn_context' && payload) {
      model = extractModel(payload) ?? model;
      continue;
    }

    if (type === 'event_msg' && payload?.type === 'token_count') {
      const perTurn = usageFromLastTokenCount(payload);
      if (perTurn) {
        pushTurn(perTurn);
        continue;
      }
      // Fallback: session-cumulative totals, credit the field-wise delta.
      const total = payload.info?.total_token_usage;
      if (total && typeof total.input_tokens === 'number') {
        const cur = {
          input: total.input_tokens,
          output: total.output_tokens ?? 0,
          cached: total.cached_input_tokens ?? 0,
        };
        if (prevTotal === null) {
          // First cumulative event seeds the baseline AND credits the first call.
          pushTurn({ input: cur.input, output: cur.output, cacheRead: cur.cached, cacheWrite: 0 });
        } else if (cur.input >= prevTotal.input && cur.output >= prevTotal.output) {
          pushTurn({
            input: cur.input - prevTotal.input,
            output: cur.output - prevTotal.output,
            cacheRead: cur.cached - prevTotal.cached,
            cacheWrite: 0,
          });
        }
        prevTotal = cur;
      }
      continue;
    }

    if (type === 'response_item' && payload) {
      model = extractModel(payload) ?? model;
      switch (payload.type) {
        case 'message':
          if (payload.role === 'user') pendingInput.push(...(payload.content ? textBlocks(payload.content, 'user-text') : []));
          else if (payload.role === 'assistant') output.push(...(payload.content ? textBlocks(payload.content, 'assistant-text') : []));
          break;
        case 'function_call': {
          const name = typeof payload.name === 'string' ? payload.name : 'unknown';
          callNames.set(String(payload.call_id ?? ''), name);
          output.push({
            kind: 'tool-use',
            tool: name,
            toolUseId: String(payload.call_id ?? ''),
            input: parseArgs(payload.arguments),
          });
          break;
        }
        case 'function_call_output':
        case 'custom_tool_call_output':
          pendingInput.push({
            kind: 'tool-result',
            tool: callNames.get(String(payload.call_id ?? '')) ?? 'unknown',
            toolUseId: String(payload.call_id ?? ''),
            text: String(payload.output ?? ''),
            isError: outputIsError(payload.output),
          });
          break;
        case 'reasoning': {
          const text = typeof payload.summary === 'string' ? payload.summary : '';
          if (text) output.push({ kind: 'thinking', text });
          break;
        }
        default:
          break;
      }
      continue;
    }
    // Unknown envelope types (compacted, inter_agent_communication, ...) are skipped.
  }

  return {
    id,
    agent: 'codex',
    project: project || 'unknown',
    model: model || 'unknown',
    filePath,
    firstTs,
    turns,
  };
}
