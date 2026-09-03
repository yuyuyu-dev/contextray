import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { SessionBreakdown } from '../analyze/breakdown.js';
import type { AgentId } from '../sources/types.js';

export interface Snapshot {
  version: 1;
  createdAt: string;
  agent: AgentId;
  sessionCount: number;
  reportHash: string;
  breakdown: SessionBreakdown;
}

// Only numeric aggregates, never file paths or code text: this is the payload
// that a future v2 anonymous leaderboard would accept.
export function reportHash(bd: SessionBreakdown): string {
  const numeric = JSON.stringify({
    v: 1,
    sessionCount: bd.sessionCount,
    turnCount: bd.turnCount,
    totalInput: bd.totalInput,
    totalOutput: bd.totalOutput,
    totalCacheRead: bd.totalCacheRead,
    totalCost: Math.round(bd.totalCost * 100),
  });
  return createHash('sha256').update(numeric).digest('hex').slice(0, 16);
}

export function defaultSnapshotPath(home: string = os.homedir()): string {
  return path.join(home, '.ctxray', 'snapshot.json');
}

export function writeSnapshot(snapshot: Snapshot, filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
}

export function readSnapshot(filePath: string): Snapshot | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Snapshot;
  } catch {
    return null;
  }
}
