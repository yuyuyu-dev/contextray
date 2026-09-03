export type AgentId = 'claude' | 'codex';

export interface TurnUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export type Block =
  | { kind: 'user-text'; text: string }
  | { kind: 'tool-result'; tool: string; toolUseId: string; text: string; isError: boolean }
  | { kind: 'tool-use'; tool: string; toolUseId: string; input: Record<string, unknown> }
  | { kind: 'thinking'; text: string }
  | { kind: 'assistant-text'; text: string }
  | { kind: 'system' };

export interface Turn {
  seq: number;
  model: string;
  usage: TurnUsage;
  blocks: Block[];
}

export interface Session {
  id: string;
  agent: AgentId;
  project: string;
  model: string;
  filePath: string;
  firstTs: number;
  turns: Turn[];
}

export interface ParseOptions {
  project?: string;
}
