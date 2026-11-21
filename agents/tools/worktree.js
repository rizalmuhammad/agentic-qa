'use strict';

/**
 * One worktree per task.
 *
 * Two agents shared one working tree in the last batch and both stalled with
 * uncommitted work that could not be told apart. Each task now gets its own
 * branch and its own directory outside the repo, with node_modules symlinked
 * so a run does not reinstall 70 packages.
 *
 * Usage:
 *   node agents/tools/worktree.js create <name> [base]
 *   node agents/tools/worktree.js list
 *   node agents/tools/worktree.js remove <name>
 *
 * Env: AGENT_WT_ROOT overrides where worktrees live (default: temp dir).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const WT_ROOT = process.env.AGENT_WT_ROOT || path.join(os.tmpdir(), 'agentic-qa-wt');

function git(args, cwd = ROOT) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function create(name, base = 'origin/main') {
  const dir = path.join(WT_ROOT, name);
  const branch = `task/${name}`;
  if (fs.existsSync(dir)) throw new Error(`worktree already exists: ${dir}`);

  fs.mkdirSync(WT_ROOT, { recursive: true });
  git(['worktree', 'add', '-q', '-b', branch, dir, base]);

  const modules = path.join(ROOT, 'node_modules');
  if (fs.existsSync(modules) && !fs.existsSync(path.join(dir, 'node_modules'))) {
    fs.symlinkSync(modules, path.join(dir, 'node_modules'), 'junction');
  }

  return { name, branch, dir };
}

function remove(name) {
  const dir = path.join(WT_ROOT, name);
  const branch = `task/${name}`;
  if (fs.existsSync(dir)) git(['worktree', 'remove', '--force', dir]);
  try { git(['branch', '-D', branch]); } catch { /* branch already gone */ }
  return { name, dir };
}

function list() {
  const out = git(['worktree', 'list', '--porcelain']);
  const entries = [];
  let current = {};
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) { if (current.path) entries.push(current); current = { path: line.slice(9) }; }
    else if (line.startsWith('branch ')) current.branch = line.slice(7);
  }
  if (current.path) entries.push(current);
  return entries;
}

function main() {
  const [command, name, base] = process.argv.slice(2);
  if (command === 'create' && name) {
    const w = create(name, base);
    console.log(JSON.stringify(w, null, 2));
    console.log(`\nexport PATH=/tmp/opencode/nodedist/bin:$PATH`);
    console.log(`cd ${w.dir}`);
    return;
  }
  if (command === 'remove' && name) {
    console.log(JSON.stringify(remove(name), null, 2));
    return;
  }
  if (command === 'list' || command === undefined) {
    console.log(JSON.stringify(list(), null, 2));
    return;
  }
  console.error('usage: worktree.js create <name> [base] | list | remove <name>');
  process.exit(2);
}

if (require.main === module) main();

module.exports = { create, remove, list };
