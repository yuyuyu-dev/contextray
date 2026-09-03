import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseClaudeSession } from '../src/sources/claude.js';

const fixture = fileURLToPath(new URL('./fixtures/claude-sample.jsonl', import.meta.url));

describe('parseClaudeSession', () => {
  const session = parseClaudeSession(fixture, { project: 'demo' });

  it('identifies the session', () => {
    expect(session.agent).toBe('claude');
    expect(session.id).toBe('claude-sample');
    expect(session.project).toBe('demo');
    expect(session.model).toBe('claude-sonnet-4-5');
    expect(session.firstTs).toBe(Date.parse('2026-08-01T00:00:00.000Z'));
  });

  it('groups records into turns, one per assistant call', () => {
    expect(session.turns).toHaveLength(3);
  });

  it('captures real usage tokens per turn', () => {
    const t0 = session.turns[0];
    expect(t0.usage).toEqual({ input: 1200, output: 30, cacheRead: 400, cacheWrite: 0 });
    expect(session.turns[2].usage.input).toBe(1900);
  });

  it('attaches the user text to the first turn', () => {
    const blocks = session.turns[0].blocks;
    expect(blocks[0]).toMatchObject({ kind: 'user-text', text: 'hello, scan the repo' });
  });

  it('resolves tool_result to the tool name that produced it', () => {
    const t1 = session.turns[1];
    const results = t1.blocks.filter((b) => b.kind === 'tool-result');
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ kind: 'tool-result', tool: 'Read', toolUseId: 'tu1', isError: false });
    expect(results[1]).toMatchObject({ kind: 'tool-result', tool: 'Read', isError: true });
    expect(results[1].text).toBe('ERROR: file not found');
  });

  it('carries tool_use blocks with name and input', () => {
    const t1 = session.turns[1];
    const bash = t1.blocks.find((b) => b.kind === 'tool-use' && b.tool === 'Bash');
    expect(bash).toMatchObject({ kind: 'tool-use', tool: 'Bash', toolUseId: 'tu2' });
  });

  it('returns zero turns for a file with no assistant records', () => {
    const dir = path.join(os.tmpdir(), `contextray-empty-${Date.now()}`);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'empty.jsonl');
    fs.writeFileSync(
      file,
      [
        '{"type":"user","message":{"role":"user","content":"hello"}}',
        'this line is not valid json',
        '{"type":"user","message":{"role":"user","content":"world"}}',
      ].join('\n'),
    );
    const parsed = parseClaudeSession(file);
    expect(parsed.turns).toHaveLength(0);
    expect(parsed.id).toBe('empty');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
