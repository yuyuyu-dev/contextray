import type { SessionBreakdown } from './breakdown.js';

export interface WasteDims {
  toolNoise: number;
  repeatedRead: number;
  invalidOutput: number;
  cacheUtil: number;
}

export interface WasteResult {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  dims: WasteDims;
  topIssue: string;
  suggestions: string[];
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

const DIM_WEIGHTS: Array<[keyof WasteDims, number]> = [
  ['toolNoise', 0.45],
  ['repeatedRead', 0.25],
  ['invalidOutput', 0.15],
  ['cacheUtil', 0.15],
];

const SUGGESTIONS: Record<keyof WasteDims, string> = {
  toolNoise: 'Reduce tool output: truncate large JSON results, or summarize inside the tool itself.',
  repeatedRead: 'Same files read repeatedly: use a code-index (MCP) instead of raw reads.',
  invalidOutput: 'Error-heavy output: add a retry cap so failed commands do not loop.',
  cacheUtil: 'Low cache reuse: enable prompt caching and keep the prompt prefix stable.',
};

export function wasteScore(bd: SessionBreakdown): WasteResult {
  const content = bd.contentTokens || 1;
  const toolNoise = clamp01(bd.toolResultTokens / content);
  const repeatedRead = bd.uniqueReadTargets > 0 ? clamp01(bd.repeatedReads.length / bd.uniqueReadTargets) : 0;
  const invalidOutput = clamp01(bd.errorTokens / Math.max(1, bd.toolResultTokens));
  const totalInput = bd.totalInput || 1;
  const cacheUtil = clamp01((bd.totalCacheRead + bd.totalCacheWrite) / totalInput);
  const cacheWaste = 1 - clamp01(cacheUtil / 0.2);

  const dims: WasteDims = { toolNoise, repeatedRead, invalidOutput, cacheUtil: cacheWaste };
  const score = Math.round(100 * DIM_WEIGHTS.reduce((acc, [k, w]) => acc + dims[k] * w, 0));
  const grade: WasteResult['grade'] = score < 20 ? 'A' : score < 40 ? 'B' : score < 60 ? 'C' : score < 80 ? 'D' : 'F';

  const ranked = [...DIM_WEIGHTS].sort((a, b) => dims[b[0]] * b[1] - dims[a[0]] * a[1]);
  const top = ranked[0][0];

  const issueText: Record<keyof WasteDims, string> = {
    toolNoise: `tool output is ${Math.round(toolNoise * 100)}% of all content tokens`,
    repeatedRead: `${bd.repeatedReads.length} files were read repeatedly`,
    invalidOutput: `${Math.round(invalidOutput * 100)}% of tool output is error text`,
    cacheUtil: `prompt cache reuse is low (${Math.round(cacheUtil * 100)}%)`,
  };

  return {
    score,
    grade,
    dims,
    topIssue: issueText[top],
    suggestions: ranked.slice(0, 2).map(([k]) => SUGGESTIONS[k]),
  };
}
