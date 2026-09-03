import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AgentId } from './types.js';

export function claudeProjectsDir(home: string = os.homedir()): string {
  return path.join(home, '.claude', 'projects');
}

export function listClaudeSessions(home: string = os.homedir()): string[] {
  const root = claudeProjectsDir(home);
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith('.jsonl')) out.push(path.join(dir, file));
    }
  }
  return out.sort();
}

export function listCodexSessions(home: string = os.homedir()): string[] {
  const root = path.join(home, '.codex', 'sessions');
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.jsonl')) out.push(p);
    }
  };
  walk(root);
  return out.sort();
}

export function detectAgent(home: string = os.homedir()): AgentId {
  return fs.existsSync(claudeProjectsDir(home)) ? 'claude' : 'codex';
}
