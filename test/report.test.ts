import { describe, expect, it } from 'vitest';
import { donutChart } from '../src/report/chart.js';
import { renderHtml } from '../src/report/html.js';
import { renderSummary, renderShareCard } from '../src/report/text.js';
import { analyzeSessions } from '../src/analyze/breakdown.js';
import { parseClaudeSession } from '../src/sources/claude.js';
import { fileURLToPath } from 'node:url';

const claudeFixture = fileURLToPath(new URL('./fixtures/claude-sample.jsonl', import.meta.url));

describe('donutChart', () => {
  it('renders one path per non-zero segment', () => {
    const svg = donutChart(
      [
        { label: 'a', value: 100, color: '#e11d48' },
        { label: 'b', value: 0, color: '#6366f1' },
        { label: 'c', value: 50, color: '#10b981' },
      ],
      { centerLabel: '42' },
    );
    expect(svg).toContain('<svg');
    expect((svg.match(/<path/g) ?? []).length).toBe(2);
    expect(svg).toContain('42');
  });
});

describe('renderHtml', () => {
  const bd = analyzeSessions([parseClaudeSession(claudeFixture, { project: 'demo' })]);
  const html = renderHtml(bd, 'claude', '2026-08-07T00:00:00.000Z');

  it('is self-contained (no external references)', () => {
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).toContain('<svg');
  });

  it('includes headline numbers and privacy footer', () => {
    expect(html).toContain('input tokens');
    expect(html).toContain('est. cost');
    expect(html).toContain('No data leaves your machine');
  });

  it('escapes file paths in repeated reads', () => {
    const bd2 = analyzeSessions([parseClaudeSession(claudeFixture, { project: 'demo' })]);
    const html2 = renderHtml(bd2, 'claude', '2026-08-07T00:00:00.000Z');
    expect(html2).toBe(html); // deterministic output
  });
});

describe('renderShareCard', () => {
  const bd = analyzeSessions([parseClaudeSession(claudeFixture, { project: 'demo' })]);

  it('contains grade, top issue and the npx command', () => {
    const card = renderShareCard(bd, 'claude');
    expect(card).toMatch(/waste score \d+\/100 · grade [A-F]/);
    expect(card).toContain('top issue:');
    expect(card).toContain('npx contextray scan');
    expect(card).toContain('$');
  });

  it('is empty when there is no data', () => {
    const empty = analyzeSessions([]);
    expect(renderShareCard(empty, 'claude')).toBe('');
  });
});
