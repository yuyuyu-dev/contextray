import fs from 'node:fs';
import path from 'node:path';
import type { Block, ParseOptions, Session, Turn } from './types.js';

interface RawRecord {
  type?: string;
  timestamp?: string;
  message?: {
    role?: string;
    model?: string;
    content?: unknown;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
}

function readJsonLines(filePath: string): RawRecord[] {
  const text = fs.readFileSync(filePath, 'utf-8');
  const records: RawRecord[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed) as RawRecord);
    } catch {
      // Skip malformed lines so one corrupt record never kills a whole session.
    }
  }
  return records;
}

function blocksFromUserRecord(record: RawRecord, toolNames: Map<string, string>): Block[] {
  const content = record.message?.content;
  if (typeof content === 'string') {
    return [{ kind: 'user-text', text: content }];
  }
  if (!Array.isArray(content)) return [];
  const blocks: Block[] = [];
  for (const item of content) {
    if (typeof item !== 'object' || item === null) continue;
    if (item.type === 'tool_result') {
      const text = typeof item.content === 'string' ? item.content : JSON.stringify(item.content ?? '');
      blocks.push({
        kind: 'tool-result',
        tool: toolNames.get(item.tool_use_id) ?? 'unknown',
        toolUseId: item.tool_use_id ?? '',
        text,
        isError: item.is_error === true,
      });
    } else if (item.type === 'text') {
      blocks.push({ kind: 'user-text', text: String(item.text ?? '') });
    }
  }
  return blocks;
}

function blocksFromAssistantRecord(record: RawRecord): Block[] {
  const content = record.message?.content;
  if (!Array.isArray(content)) return [];
  const blocks: Block[] = [];
  for (const item of content) {
    if (typeof item !== 'object' || item === null) continue;
    if (item.type === 'thinking') {
      blocks.push({ kind: 'thinking', text: String(item.thinking ?? '') });
    } else if (item.type === 'text') {
      blocks.push({ kind: 'assistant-text', text: String(item.text ?? '') });
    } else if (item.type === 'tool_use') {
      blocks.push({
        kind: 'tool-use',
        tool: String(item.name ?? 'unknown'),
        toolUseId: String(item.id ?? ''),
        input: (item.input as Record<string, unknown>) ?? {},
      });
    }
  }
  return blocks;
}

export function parseClaudeSession(filePath: string, opts: ParseOptions = {}): Session {
  const records = readJsonLines(filePath);

  const toolNames = new Map<string, string>();
  for (const rec of records) {
    if (rec.type !== 'assistant') continue;
    const content = rec.message?.content;
    if (!Array.isArray(content)) continue;
    for (const item of content) {
      if (typeof item === 'object' && item !== null && item.type === 'tool_use' && item.id && item.name) {
        toolNames.set(String(item.id), String(item.name));
      }
    }
  }

  const turns: Turn[] = [];
  let pending: Block[] = [];
  let seq = 0;
  let firstTs = 0;
  let model = '';

  for (const rec of records) {
    const ts = rec.timestamp ? Date.parse(rec.timestamp) || 0 : 0;
    if (!firstTs && ts) firstTs = ts;

    if (rec.type === 'user') {
      pending.push(...blocksFromUserRecord(rec, toolNames));
    } else if (rec.type === 'assistant') {
      const usage = rec.message?.usage ?? {};
      const turnModel = rec.message?.model ?? '';
      turns.push({
        seq: seq++,
        model: turnModel,
        usage: {
          input: usage.input_tokens ?? 0,
          output: usage.output_tokens ?? 0,
          cacheRead: usage.cache_read_input_tokens ?? 0,
          cacheWrite: usage.cache_creation_input_tokens ?? 0,
        },
        blocks: [...pending, ...blocksFromAssistantRecord(rec)],
      });
      pending = [];
      if (!model) model = turnModel;
    }
  }

  const id = path.basename(filePath, '.jsonl');
  const project = opts.project ?? path.basename(path.dirname(filePath));

  return { id, agent: 'claude', project, model, filePath, firstTs, turns };
}
