import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { parseCodexSession } from '../src/sources/codex.js';

const sample = fileURLToPath(new URL('./fixtures/codex-sample.jsonl', import.meta.url));
const totalOnly = fileURLToPath(new URL('./fixtures/codex-total-only.jsonl', import.meta.url));

describe('parseCodexSession (envelope format)', () => {
  const session = parseCodexSession(sample, { project: 'acme' });

  it('identifies the session', () => {
    expect(session.agent).toBe('codex');
    expect(session.id).toBe('019d2fac-0b38-70f0-baff-a394265d8291');
    expect(session.project).toBe('acme');
    expect(session.model).toBe('gpt-5');
    expect(session.firstTs).toBe(Date.parse('2026-08-02T09:00:00.000Z'));
  });

  it('creates one turn per token_count event', () => {
    expect(session.turns).toHaveLength(3);
  });

  it('captures per-turn usage from last_token_usage', () => {
    expect(session.turns[0].usage).toEqual({ input: 1000, output: 50, cacheRead: 200, cacheWrite: 0 });
    expect(session.turns[2].usage.input).toBe(1200);
  });

  it('resolves function_call_output to the tool name and error flag', () => {
    const t1 = session.turns[1];
    const bash = t1.blocks.find((b) => b.kind === 'tool-result' && b.tool === 'Bash');
    expect(bash).toMatchObject({ kind: 'tool-result', tool: 'Bash', isError: false });

    const t2 = session.turns[2];
    const read = t2.blocks.find((b) => b.kind === 'tool-result' && b.tool === 'Read');
    expect(read).toMatchObject({ kind: 'tool-result', tool: 'Read', isError: true });
    expect(read?.text).toContain('file not found');
  });

  it('keeps assistant text and tool_use blocks', () => {
    const t1 = session.turns[1];
    expect(t1.blocks.some((b) => b.kind === 'assistant-text' && b.text === 'Let me run the tests')).toBe(true);
    expect(t1.blocks.some((b) => b.kind === 'tool-use' && b.tool === 'Bash')).toBe(true);
  });
});

describe('parseCodexSession (cumulative totals fallback)', () => {
  const session = parseCodexSession(totalOnly, { project: 'acme' });

  it('computes per-turn usage as deltas of total_token_usage', () => {
    expect(session.turns).toHaveLength(3);
    expect(session.turns[0].usage.input).toBe(1000);
    expect(session.turns[1].usage.input).toBe(600);
    expect(session.turns[2].usage.input).toBe(300); // 1800 - 1500 (regression reseeded at 1500)
  });

  it('tolerates files with no model info', () => {
    expect(session.model).toBe('unknown');
  });
});
