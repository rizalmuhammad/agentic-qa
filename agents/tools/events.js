'use strict';

/**
 * One append-only event line per stage, shared by every flow.
 *
 * Each flow keeps its own detailed log; this is the cross-flow index that makes
 * a run replayable without knowing which script produced it.
 *
 * Usage:
 *   node agents/tools/events.js                       # print the last 20 events
 *   node agents/tools/events.js --task chg-03         # filter by task
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const FILE = path.join(ROOT, 'runs', 'events.jsonl');

function append(event) {
  const line = {
    ts: new Date().toISOString(),
    flow: event.flow || 'unknown',
    task: event.task || 'unknown',
    stage: event.stage || 'unknown',
    status: event.status || 'unknown',
    artifact: event.artifact || null,
  };
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.appendFileSync(FILE, `${JSON.stringify(line)}\n`);
  return line;
}

function read(limit = 20, task = null) {
  if (!fs.existsSync(FILE)) return [];
  const lines = fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const filtered = task ? lines.filter((l) => l.task === task) : lines;
  return filtered.slice(-limit);
}

if (require.main === module) {
  const i = process.argv.indexOf('--task');
  const task = i === -1 ? null : process.argv[i + 1];
  console.log(JSON.stringify(read(20, task), null, 2));
}

module.exports = { append, read, FILE };
