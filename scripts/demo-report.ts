// Demo report generator: renders the terminal summary + shareable HTML report
// from the synthetic test fixtures, so anyone can produce a screenshot for the
// README or launch posts WITHOUT touching real session data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseClaudeSession } from '../src/sources/claude.js';
import { parseCodexSession } from '../src/sources/codex.js';
import { analyzeSessions } from '../src/analyze/breakdown.js';
import { renderSummary } from '../src/report/text.js';
import { renderHtml } from '../src/report/html.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const fixtures = {
  claude: path.join(root, 'test', 'fixtures', 'claude-sample.jsonl'),
  codex: path.join(root, 'test', 'fixtures', 'codex-sample.jsonl'),
};

const sessions = [
  parseClaudeSession(fixtures.claude, { project: 'demo-app' }),
  parseCodexSession(fixtures.codex, { project: 'demo-app' }),
];
const bd = analyzeSessions(sessions);

console.log(renderSummary(bd, 'claude'));
console.log('');
console.log('-'.repeat(48));
console.log('(demo data from test fixtures - run this on your own sessions with `npx contextray scan`)');

const outDir = path.join(root, 'dist-demo');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'ctx-report.html');
fs.writeFileSync(out, renderHtml(bd, 'claude', new Date().toISOString()));
console.log('');
console.log('Demo HTML report written to ' + out);
console.log('Screenshot it and save as docs/preview.png for the README / launch posts.');
