'use strict';

/**
 * Phase 5: execute all 30 change sets, selected versus full.
 *
 * For every change set that simulate.js generates:
 *   1. pick a seeded bug from the written table below (no guesswork at run time);
 *   2. run the selected tests with that bug on, on the set's own PORT;
 *   3. run the full suite with the same bug on, same PORT, fresh server;
 *   4. record both outcomes plus the tail of each run's stdout.
 *
 * A miss is: the selected run is green while the full run is red. A change set
 * that selects no tests at all is recorded as a *vacuous* green - nothing was
 * verified - because a vacuous green is exactly the silent gap this phase
 * exists to find, not a pass.
 *
 * The bug is installed through QA_SEEDED_BUGS on the server process (read by
 * playwright.config.ts and forwarded to app/server.js). SEEDED_BUGS is cleared
 * so tests/seeded-bugs.spec.ts skips itself: that spec proves the seeded-bug
 * harness, it is not a regression test, and letting it assert the bug would
 * make the full suite detect any bug by construction.
 *
 * Usage: node agents/release/execute-all.js [--fresh]
 *   --fresh  ignore a previous executed-30.json instead of resuming it
 *
 * Env: npm/Playwright must be installed; the caller sets PATH for node and
 * PLAYWRIGHT_BROWSERS_PATH for the browser binaries.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { decide } = require('./select');
const { buildChanges } = require('./simulate');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'runs', 'phase5');
const RESULT_FILE = path.join(OUT, 'executed-30.json');
const LOG_DIR = '/tmp/opencode/exec30-logs';
const JSON_DIR = '/tmp/opencode/exec30-json';
const BIN = path.join(ROOT, 'node_modules', '.bin', 'playwright');

const BASE_PORT = 4300; // one port per change set; selected and full run in turn
const BASELINE_PORT = 4299;
const RUN_TIMEOUT_MS = 10 * 60_000;
const TAIL_LINES = 12;

/**
 * Written bug choice. AREA_BUG is the rule from the issue, keyed by the test
 * area the change affects. `orders` is not in the issue's list but the batch
 * contains orders-only change sets; BUG-10 is the only orders-flow bug, so it
 * is written here rather than skipped or guessed.
 */
const AREA_BUG = {
  cart: { bug: 'BUG-12', alternate: 'BUG-03', symptom: 'removing an item leaves a stale total' },
  checkout: { bug: 'BUG-01', alternate: 'BUG-07', symptom: 'total counts tax twice' },
  catalog: { bug: 'BUG-08', alternate: 'BUG-09', symptom: 'search becomes case-sensitive' },
  auth: { bug: 'BUG-02', symptom: 'empty password is accepted' },
  orders: { bug: 'BUG-10', symptom: 'order history leaks other users orders' },
  api: { bug: 'BUG-04', symptom: 'third product-list call returns 500' }, // fixtures / config
};

/**
 * Explicit decision for each of the 30 change sets, so the batch is auditable
 * row by row. `bug: 'none'` means the files touch no mapped test area: no
 * selected and no full execution, recorded as "no tests required".
 *
 * Where a set touches several areas, the rationale names the area whose bug is
 * used. For catalog-only sets BUG-08 (the catalog bug) is used rather than
 * BUG-09, which manifests in the cart and would manufacture a miss.
 */
const SET_BUG = {
  'chg-01': { bug: 'BUG-01', area: 'checkout', why: 'app-wide server change; checkout totals is the highest-severity mapped area' },
  'chg-02': { bug: 'BUG-07', area: 'checkout', why: 'UI change; discount arithmetic is the checkout behaviour the UI renders' },
  'chg-03': { bug: 'BUG-12', area: 'cart', why: 'cart tests changed' },
  'chg-04': { bug: 'BUG-02', area: 'auth', why: 'auth tests changed' },
  'chg-05': { bug: 'BUG-01', area: 'checkout', why: 'checkout tests changed' },
  'chg-06': { bug: 'BUG-08', area: 'catalog', why: 'catalog tests changed' },
  'chg-07': { bug: 'BUG-10', area: 'orders', why: 'orders tests changed' },
  'chg-08': { bug: 'BUG-04', area: 'api', why: 'fixtures decide the api-area runs' },
  'chg-09': { bug: 'BUG-04', area: 'api', why: 'playwright.config decides the api-area runs' },
  'chg-10': { bug: 'none', area: 'none', why: 'docs only, no mapped test area' },
  'chg-11': { bug: 'none', area: 'none', why: 'docs only, no mapped test area' },
  'chg-12': { bug: 'none', area: 'none', why: 'README only, no mapped test area' },
  'chg-13': { bug: 'BUG-03', area: 'cart', why: 'server plus cart tests; cart area bug (alternate)' },
  'chg-14': { bug: 'BUG-08', area: 'catalog', why: 'UI plus catalog tests; catalog area bug' },
  'chg-15': { bug: 'BUG-04', area: 'api', why: 'fixtures plus checkout tests; fixtures decide' },
  'chg-16': { bug: 'BUG-12', area: 'cart', why: 'server plus UI; cart totals is a mapped area' },
  'chg-17': { bug: 'none', area: 'none', why: 'CI workflow, no mapped test area; approval is high risk' },
  'chg-18': { bug: 'none', area: 'none', why: 'release policy docs, no mapped test area; approval is high risk' },
  'chg-19': { bug: 'none', area: 'none', why: 'MCP config, no mapped test area; approval is high risk' },
  'chg-20': { bug: 'BUG-02', area: 'auth', why: 'server plus UI plus fixtures; auth used for coverage' },
  'chg-21': { bug: 'BUG-07', area: 'checkout', why: 'server plus docs; checkout discount is a mapped area' },
  'chg-22': { bug: 'BUG-01', area: 'checkout', why: 'UI plus docs; checkout totals is a mapped area' },
  'chg-23': { bug: 'BUG-03', area: 'cart', why: 'cart tests plus docs' },
  'chg-24': { bug: 'BUG-02', area: 'auth', why: 'auth tests plus docs' },
  'chg-25': { bug: 'BUG-07', area: 'checkout', why: 'checkout tests plus docs' },
  'chg-26': { bug: 'BUG-08', area: 'catalog', why: 'catalog tests plus docs' },
  'chg-27': { bug: 'BUG-10', area: 'orders', why: 'orders tests plus docs' },
  'chg-28': { bug: 'BUG-04', area: 'api', why: 'fixtures plus docs' },
  'chg-29': { bug: 'BUG-04', area: 'api', why: 'playwright.config plus docs' },
  'chg-30': { bug: 'none', area: 'none', why: 'docs only, no mapped test area' },
};

const KNOWN_BUGS = new Set(Object.values(AREA_BUG).flatMap((v) => [v.bug, v.alternate].filter(Boolean)));

function pad(n) {
  return String(n).padStart(2, '0');
}

function ensureDirs() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.mkdirSync(JSON_DIR, { recursive: true });
}

function tailOf(text) {
  const lines = String(text || '').split('\n').map((l) => l.replace(/\s+$/, '')).filter(Boolean);
  return lines.slice(-TAIL_LINES).join('\n');
}

function readStats(jsonPath) {
  try {
    const stats = JSON.parse(fs.readFileSync(jsonPath, 'utf8')).stats;
    return {
      failed: stats.unexpected || 0,
      passed: stats.expected || 0,
      skipped: stats.skipped || 0,
      flaky: stats.flaky || 0,
      durationSeconds: Math.round((stats.duration || 0) / 100) / 10,
    };
  } catch {
    return null;
  }
}

function statsFromLog(log) {
  const n = (re) => Number((log.match(re) || [])[1] || 0);
  return {
    failed: n(/(\d+) failed/),
    passed: n(/(\d+) passed/),
    skipped: n(/(\d+) skipped/),
    flaky: n(/(\d+) flaky/),
    durationSeconds: null,
    fallback: true,
  };
}

/**
 * Run one Playwright invocation. The full log stays in /tmp for evidence; the
 * tail goes into executed-30.json because the result file must be reviewable
 * without the logs.
 */
function runSuite({ label, port, files, bug }) {
  const args = ['test'];
  if (files && files.length) args.push(...files);
  args.push('--reporter=list,json', '--workers=1', '--retries=0');

  const logPath = path.join(LOG_DIR, `${label}.log`);
  const jsonPath = path.join(JSON_DIR, `${label}.json`);
  fs.rmSync(jsonPath, { force: true });

  const startedAt = Date.now();
  const child = spawnSync(BIN, args, {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      QA_SEEDED_BUGS: bug || '',
      SEEDED_BUGS: '', // keep tests/seeded-bugs.spec.ts skipped
      PLAYWRIGHT_JSON_OUTPUT_NAME: jsonPath,
      PLAYWRIGHT_HTML_OPEN: 'never',
      CI: '',
    },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: RUN_TIMEOUT_MS,
  });

  const wallSeconds = Math.round((Date.now() - startedAt) / 100) / 10;
  const log = [child.stdout, child.stderr].filter(Boolean).join('\n');
  fs.writeFileSync(logPath, log);

  const stats = readStats(jsonPath) || statsFromLog(log);
  const timedOut = child.error && child.error.code === 'ETIMEDOUT';
  const exitCode = timedOut ? 'timeout' : child.status;

  return {
    label,
    command: `${BIN.split('/').slice(-2).join('/')} ${args.join(' ')}`,
    port,
    bug: bug || null,
    tests: files || 'all',
    exitCode,
    ...stats,
    green: exitCode === 0,
    timedOut: Boolean(timedOut),
    wallSeconds,
    logPath,
    tail: tailOf(log),
  };
}

/**
 * A run is only usable if the app server stayed up for all of it. Playwright
 * reports a dead server as ordinary test failures, so without this check a
 * killed server looks like a caught defect. Two independent signals:
 *   - the full suite must skip exactly the 15 seeded-bug tests;
 *   - neither log may contain a refused connection.
 * An unusable run is re-run on a fresh port instead of being recorded.
 */
function runProblems(run, { full }) {
  if (!run) return ['no run recorded'];
  if (run.vacuous) return [];

  const problems = [];
  if (run.timedOut) problems.push('timed out');
  const log = run.logPath && fs.existsSync(run.logPath) ? fs.readFileSync(run.logPath, 'utf8') : '';
  if (/ECONNREFUSED|EADDRINUSE/.test(log)) problems.push('app server unavailable during the run');
  if (run.passed + run.failed + run.skipped === 0) problems.push('no tests counted');
  if (full && run.skipped !== 15) problems.push(`seeded spec did not skip cleanly (${run.skipped} skipped, expected 15)`);
  if (!full && run.skipped !== 0) problems.push(`unexpected skips in a selected run (${run.skipped})`);
  return problems;
}

function runChecked({ label, port, files, bug, full }) {
  let run = null;
  let problems = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const attemptLabel = attempt === 1 ? label : `${label}-retry${attempt - 1}`;
    run = runSuite({ label: attemptLabel, port: port + (attempt - 1) * 50, files, bug });
    run.attempt = attempt;
    problems = runProblems(run, { full });
    run.problems = problems;
    if (!problems.length) return run;
    console.log(`[${label}] attempt ${attempt} unusable: ${problems.join('; ')}`);
  }
  return run;
}

function previousProblems(entry) {
  if (!entry || entry.decision === 'no-tests-required') return [];
  return [
    ...runProblems(entry.selectedRun, { full: false }),
    ...runProblems(entry.fullRun, { full: true }),
  ];
}

function loadPrevious(fresh) {
  if (fresh) return null;
  try {
    return JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function summarise(state) {
  const done = state.sets.filter((s) => s.decision);
  const executed = done.filter((s) => s.decision === 'executed');
  const missed = executed.filter((s) => s.missedVsFull);
  const vacuous = executed.filter((s) => s.selectedRun && s.selectedRun.vacuous);
  const fullDetected = executed.filter((s) => s.fullRun && !s.fullRun.green);
  const undetected = executed.filter((s) => s.fullRun && s.fullRun.green);

  return {
    sets: state.sets.length,
    executed: executed.length,
    noTestsRequired: done.filter((s) => s.decision === 'no-tests-required').length,
    withoutSelectedTests: vacuous.length,
    missedDefects: missed.length,
    missedIds: missed.map((s) => s.id),
    vacuousMissIds: missed.filter((s) => s.selectedRun.vacuous).map((s) => s.id),
    detectedByFull: fullDetected.length,
    undetectedByFull: undetected.map((s) => s.id),
    selectedRuns: executed.filter((s) => s.selectedRun && !s.selectedRun.vacuous).length,
    fullRuns: executed.length,
    runSeconds: Math.round(done.reduce((n, s) => n + (s.selectedRun ? s.selectedRun.wallSeconds : 0) + (s.fullRun ? s.fullRun.wallSeconds : 0), 0) * 10) / 10,
    wallSeconds: Math.round((state.passes || []).reduce((n, p) => n + (p.wallSeconds || 0), 0) * 10) / 10,
  };
}

function write(state) {
  const pass = state.passes[state.passes.length - 1];
  if (pass && pass.startedAt && !pass.endedAt) pass.wallSeconds = Math.round((Date.now() - pass.startedAt) / 100) / 10;
  const payload = {
    note: 'Phase 5 batch execution: every generated change set, selected versus full, one seeded bug per set.',
    generatedAt: new Date().toISOString(),
    method: {
      selected: 'Playwright with the selected test files only, seeded bug on via QA_SEEDED_BUGS',
      full: 'Playwright with the whole tests/ directory, same bug and same port, fresh server',
      miss: 'selected run green while full run red',
      vacuous: 'the change set selected no test files; the selected run verified nothing and is green by construction',
      seededSpec: 'tests/seeded-bugs.spec.ts is skipped (SEEDED_BUGS empty) so full-suite detection comes from the real regression specs',
      integrity: 'a run is re-run when the log shows a refused connection or the full suite does not skip exactly 15 seeded tests',
      bugTable: 'AREA_BUG and SET_BUG in agents/release/execute-all.js',
    },
    bugTable: SET_BUG,
    baseline: state.baseline,
    passes: state.passes,
    sets: state.sets,
    summary: summarise(state),
  };
  fs.writeFileSync(RESULT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

function main() {
  const fresh = process.argv.includes('--fresh');
  ensureDirs();

  if (!fs.existsSync(BIN)) {
    console.error(`playwright not found at ${BIN}; run npm install first`);
    process.exit(2);
  }

  const changes = buildChanges();
  if (changes.length !== 30) {
    console.error(`expected 30 change sets, simulate.js produced ${changes.length}`);
    process.exit(2);
  }

  for (let i = 0; i < changes.length; i += 1) {
    const id = `chg-${pad(i + 1)}`;
    if (!SET_BUG[id]) {
      console.error(`${id} has no entry in SET_BUG; refusing to guess a bug`);
      process.exit(2);
    }
    const bug = SET_BUG[id].bug;
    if (bug !== 'none' && !KNOWN_BUGS.has(bug)) {
      console.error(`${id} uses unknown bug ${bug}`);
      process.exit(2);
    }
  }

  const previous = loadPrevious(fresh);
  const passes = previous && previous.passes ? previous.passes.slice() : [];
  if (previous && !previous.passes && previous.summary && previous.summary.wallSeconds) {
    passes.push({ startedAt: null, endedAt: null, wallSeconds: previous.summary.wallSeconds, reason: 'initial batch (recorded before run integrity retries were added)' });
  }
  passes.push({ startedAt: Date.now(), reason: passes.length ? 'repair invalid runs' : 'initial batch' });

  const state = {
    baseline: previous ? previous.baseline || null : null,
    passes,
    sets: changes.map((files, i) => {
      const id = `chg-${pad(i + 1)}`;
      const prior = previous && previous.sets ? previous.sets.find((s) => s.id === id) : null;
      if (!prior || !prior.decision) return { id, files, decision: null };

      const problems = previousProblems(prior);
      if (!problems.length) return prior;

      // Keep the unusable attempt in the record; never silently delete evidence.
      const previousAttempts = (prior.previousAttempts || []).concat([
        {
          selected: prior.selectedRun ? { failed: prior.selectedRun.failed, passed: prior.selectedRun.passed, skipped: prior.selectedRun.skipped, exitCode: prior.selectedRun.exitCode } : null,
          full: prior.fullRun ? { failed: prior.fullRun.failed, passed: prior.fullRun.passed, skipped: prior.fullRun.skipped, exitCode: prior.fullRun.exitCode } : null,
          problems,
        },
      ]);
      console.log(`[${id}] previous run unusable (${problems.join('; ')}); re-running`);
      return { id, files, decision: null, previousAttempts };
    }),
  };

  const baselineWanted = !process.argv.includes('--no-baseline') && !state.baseline;
  if (baselineWanted) {
    console.log('[baseline] full suite without a seeded bug');
    state.baseline = runChecked({ label: 'baseline-full', port: BASELINE_PORT, files: null, bug: '', full: true });
    console.log(`[baseline] ${state.baseline.failed} failed, ${state.baseline.passed} passed, ${state.baseline.skipped} skipped in ${state.baseline.wallSeconds}s`);
    write(state);
  }

  for (let i = 0; i < changes.length; i += 1) {
    const id = `chg-${pad(i + 1)}`;
    const entry = state.sets[i];

    if (entry.decision) {
      console.log(`[${id}] resume: ${entry.decision}${entry.missedVsFull ? ' (miss)' : ''}`);
      continue;
    }

    const files = changes[i];
    const decision = decide(files);
    const table = SET_BUG[id];
    const port = BASE_PORT + i;

    console.log(`[${id}] ${JSON.stringify(files)} risk=${decision.risk} selected=${decision.tests.length ? decision.tests.join(',') : '(none)'} bug=${table.bug}`);

    entry.risk = decision.risk;
    entry.approver = decision.approver;
    entry.areas = decision.areas;
    entry.selectedTests = decision.tests;
    entry.bug = table.bug === 'none' ? null : table.bug;
    entry.area = table.area;
    entry.rationale = table.why;

    if (table.bug === 'none') {
      entry.decision = 'no-tests-required';
      entry.note = `${table.why}; the selection maps no tests and the suite has none for these files`;
      entry.missedVsFull = false;
      console.log(`[${id}] no tests required (${table.why})`);
      write(state);
      continue;
    }

    if (!decision.tests.length) {
      entry.selectedRun = {
        label: `${id}-selected`,
        vacuous: true,
        executed: false,
        tests: 0,
        green: true,
        failed: 0,
        passed: 0,
        skipped: 0,
        wallSeconds: 0,
        note: 'the selection returned no test files, so no selected command ran; green is vacuous',
      };
    } else {
      entry.selectedRun = {
        vacuous: false,
        executed: true,
        ...runChecked({ label: `${id}-selected`, port, files: decision.tests, bug: table.bug, full: false }),
      };
    }

    entry.fullRun = runChecked({ label: `${id}-full`, port, files: null, bug: table.bug, full: true });
    entry.decision = 'executed';
    entry.caughtByFull = entry.fullRun.failed > 0;
    entry.missedVsFull = Boolean(entry.selectedRun.green && !entry.fullRun.green);
    entry.integrity = {
      selected: entry.selectedRun.problems || [],
      full: entry.fullRun.problems || [],
    };

    console.log(
      `[${id}] selected: ${entry.selectedRun.vacuous ? '0 tests (vacuous green)' : `${entry.selectedRun.failed} failed, ${entry.selectedRun.passed} passed`} | ` +
        `full: ${entry.fullRun.failed} failed, ${entry.fullRun.passed} passed, ${entry.fullRun.skipped} skipped` +
        `${entry.missedVsFull ? ' | MISSED' : ''} | ${(entry.selectedRun.wallSeconds + entry.fullRun.wallSeconds).toFixed(1)}s`,
    );

    write(state);
  }

  const payload = write(state);
  console.log(JSON.stringify(payload.summary, null, 2));
}

main();
