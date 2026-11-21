'use strict';

/**
 * Phase 3 team flow: Planner -> Generator -> Executor -> Healer -> Failure Analysis.
 *
 * For one requirement and one seeded bug, the flow:
 *   1. plans what to test (Planner),
 *   2. writes one test (Generator),
 *   3. runs it clean and with the bug enabled (Executor),
 *   4. proposes a fix for a failure, without applying it (Healer),
 *   5. classifies the failure from repeat runs (Failure Analysis).
 *
 * Detection is decided by the browser, not by any agent: the bug counts as found
 * only if the generated test passes clean and fails with the bug enabled.
 *
 * Usage:
 *   QA_LLM_KEY_FILE=... node agents/team/run-flow.js --case checkout-tax --bug BUG-01 --port 3210
 *   QA_LLM_KEY_FILE=... node agents/team/run-flow.js --all --port 3210
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { chat, MODEL } = require('../orchestrator/lib/model');
const { extractJson, validateProposal } = require('../orchestrator/lib/validate');
const events = require('../tools/events');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'runs', 'phase3');

const CASES = {
  'checkout-tax': { requirement: 'REQ-CHK-01', text: 'The order total equals subtotal plus 8% tax, rounded to cents.', bug: 'BUG-01' },
  'cart-negqty': { requirement: 'REQ-CART-04', text: 'A quantity of zero or below is rejected and the cart is unchanged.', bug: 'BUG-03' },
  'search-case': { requirement: 'REQ-CAT-03', text: 'Search is case-insensitive.', bug: 'BUG-08' },
  'checkout-empty': { requirement: 'REQ-CHK-03', text: 'Checkout with an empty cart returns 400 and creates no order.', bug: 'BUG-13' },
  'discount-cap': { requirement: 'REQ-CHK-02', text: 'SAVE10 takes 10% off the subtotal.', bug: 'BUG-07' },
};

function readIfExists(relative) {
  const file = path.join(ROOT, relative);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1] ?? true;
}

/* ------------------------------- agents ------------------------------- */

async function planner(caseName, testCase) {
  const reply = await chat([
    {
      role: 'system',
      content: `You are the Planner in an agentic QA team. Return JSON only:
{"areas":["..."],"tests":[{"requirement":"REQ-...","what":"one line"}],"risk":"low|medium|high","reason":"one line"}
Rules: one requirement per planned test; if the requirement is ambiguous, add "questions":[...] and set tests to []; never write test code.
Never plan an assertion about arithmetic or modulo on the test's own fixture data (for example expect((subtotalCents * 8) % 100).not.toBe(0)); plan assertions about the app's observable output, such as the exact text the page shows or a field the API returns.`,
    },
    {
      role: 'user',
      content: `Case: ${caseName}\nRequirement: ${testCase.requirement} - ${testCase.text}\nContract:\n${readIfExists('docs/CONTRACT.md').slice(0, 3000)}`,
    },
  ], { maxTokens: 3500 });
  if (reply.finishReason === 'length') throw new Error('planner reply hit the token cap');
  const plan = extractJson(reply.content);
  return { plan, usage: reply.usage, latencyMs: reply.latencyMs };
}

async function generator(testCase, plan, repairNote) {
  const system = `You are the Generator in an agentic QA team. Write one Playwright test.
Return JSON only: {"path":"tests/generated/<slug>.spec.ts","content":"<file>"}
Rules: import from '../fixtures'; the title must contain ${testCase.requirement}; exact assertions; no waitForTimeout, skip, only or force; never edit application code.
Never assert a property of your own fixture arithmetic: no expect() around a value you computed from setup, such as expect((subtotalCents * 8) % 100).not.toBe(0) or expect(computedTotal).toBeGreaterThan(0). Assert only what the app returns: visible text, a response status, or a response body field (for example toHaveText('$48.60') or expect(body.total).toBe(48.6)).
Style reference:
${readIfExists('tests/catalog.spec.ts')}
Selectors:
${readIfExists('docs/CONTRACT.md').slice(0, 2500)}`;
  const user = `Requirement: ${testCase.requirement} - ${testCase.text}\nPlan: ${JSON.stringify(plan)}${repairNote ? `\nYour previous answer was rejected: ${repairNote}` : ''}`;
  const reply = await chat([{ role: 'system', content: system }, { role: 'user', content: user }], { maxTokens: 8000 });
  return { reply, proposal: extractJson(reply.content) };
}

async function healer(testCase, failureOutput, fileContent) {
  const reply = await chat([
    {
      role: 'system',
      content: `You are the Healer in an agentic QA team. A test failed. Return JSON only:
{"diagnosis":"locator|test-step|product-bug|unknown","proposal":"the smallest diff as text","evidence":"which line of the failure supports this","apply":false}
Rules: never apply or approve your own fix; never change what the test proves; if the app is wrong, diagnose product-bug and propose nothing; no sleeps, retries or force clicks.`,
    },
    {
      role: 'user',
      content: `Requirement: ${testCase.requirement} - ${testCase.text}\nFailing test:\n${String(fileContent).slice(0, 3000)}\nFailure output:\n${String(failureOutput).slice(0, 3000)}`,
    },
  ], { maxTokens: 3000 });
  return { reply, proposal: extractJson(reply.content) };
}

async function failureAnalysis(testCase, runs, failureOutput) {
  const reply = await chat([
    {
      role: 'system',
      content: `You are Failure Analysis in an agentic QA team. Return JSON only:
{"classification":"product-bug|test-bug|environment|flaky|unknown","confidence":"high|medium|low","evidence":["..."],"missing":"what evidence would change the call"}
Rules: never call a single failure flaky; a classification without evidence is "unknown"; never close a possible product bug on your own.`,
    },
    {
      role: 'user',
      content: `Requirement: ${testCase.requirement} - ${testCase.text}\nRepeat runs (clean code): ${JSON.stringify(runs)}\nFailure output with the bug enabled:\n${String(failureOutput).slice(0, 3000)}`,
    },
  ], { maxTokens: 3500 });
  return { reply, proposal: extractJson(reply.content) };
}

/* ------------------------------ executor ------------------------------ */

function runSpec(file, seededBugs, port) {
  const started = Date.now();
  const result = spawnSync('npx', ['playwright', 'test', file, '--reporter=line'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 240_000,
    env: { ...process.env, PORT: String(port), QA_SEEDED_BUGS: seededBugs },
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  return {
    status: result.status,
    passed: result.status === 0,
    durationMs: Date.now() - started,
    output: output.split('\n').filter(Boolean).slice(-25).join('\n'),
  };
}

/* ------------------------------- flow -------------------------------- */

async function runCase(name, testCase, port, index) {
  const record = {
    case: name,
    requirement: testCase.requirement,
    seededBug: testCase.bug,
    model: MODEL,
    startedAt: new Date().toISOString(),
    stages: {},
    detected: false,
    missed: false,
    misclassified: false,
  };

  // 1. Planner
  try {
    const { plan, usage, latencyMs } = await planner(name, testCase);
    record.stages.planner = { ok: true, plan, tokens: usage.total_tokens, latencyMs };
    events.append({ flow: 'team', task: name, stage: 'planner', status: 'ok', artifact: plan.risk });
  } catch (error) {
    record.stages.planner = { ok: false, error: error.message };
    record.missed = true;
    return record;
  }

  // 2. Generator
  let file = null;
  try {
    const { proposal } = await generator(testCase, record.stages.planner.plan);
    const check = validateProposal(proposal, testCase.requirement);
    if (!check.ok) throw new Error(check.problems.join('; '));
    file = check.filePath;
    fs.mkdirSync(path.join(ROOT, 'tests', 'generated'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, file), check.content);
    record.stages.generator = { ok: true, file };
    events.append({ flow: 'team', task: name, stage: 'generator', status: 'ok', artifact: file });
  } catch (error) {
    record.stages.generator = { ok: false, error: String(error.message).slice(0, 300) };
    record.missed = true;
    return record;
  }

  // 3. Executor: clean run, then three runs with the bug enabled
  const clean = runSpec(file, '', port);
  const bugged = [runSpec(file, testCase.bug, port), runSpec(file, testCase.bug, port), runSpec(file, testCase.bug, port)];
  record.stages.executor = {
    cleanPassed: clean.passed,
    buggedPassed: bugged.filter((r) => r.passed).length,
    buggedRuns: bugged.length,
    traceHint: (bugged[0].output.match(/test-results\/[^\s]+/) || [null])[0],
  };

  // Valid test = passes clean and fails at least once with the bug on.
  events.append({ flow: 'team', task: name, stage: 'executor', status: clean.passed ? 'ok' : 'failed', artifact: record.stages.executor.traceHint || null });
  const validTest = clean.passed && bugged.some((r) => !r.passed);
  record.detected = validTest;
  record.missed = !validTest;

  if (!validTest) return record;

  // 4. Healer on the first failing run
  const failing = bugged.find((r) => !r.passed);
  try {
    const { proposal } = await healer(testCase, failing.output, readIfExists(file));
    record.stages.healer = { ok: true, proposal };
    events.append({ flow: 'team', task: name, stage: 'healer', status: proposal.diagnosis || 'unknown', artifact: null });
  } catch (error) {
    record.stages.healer = { ok: false, error: String(error.message).slice(0, 300) };
  }

  // 5. Failure Analysis with repeat-run evidence
  try {
    const { proposal } = await failureAnalysis(
      testCase,
      { attempts: 3, failures: bugged.filter((r) => !r.passed).length },
      failing.output,
    );
    record.stages.analysis = { ok: true, proposal };
    events.append({ flow: 'team', task: name, stage: 'analysis', status: proposal.classification || 'unknown', artifact: null });
    record.misclassified = proposal.classification === 'flaky';
  } catch (error) {
    record.stages.analysis = { ok: false, error: String(error.message).slice(0, 300) };
  }

  return record;
}

async function main() {
  const port = Number(arg('port', 3210));
  const all = Boolean(arg('all', false));
  const single = arg('case');
  const names = all ? Object.keys(CASES) : [single];
  if (!names[0] || !CASES[names[0]]) {
    console.error(`Pick --case <${Object.keys(CASES).join('|')}> or --all`);
    process.exit(2);
  }

  fs.mkdirSync(OUT, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(OUT, `${stamp}.jsonl`);
  const records = [];

  for (let i = 0; i < names.length; i += 1) {
    const name = names[i];
    process.stderr.write(`flow ${name} (bug ${CASES[name].bug})\n`);
    const record = await runCase(name, CASES[name], port + i, i);
    records.push(record);
    fs.appendFileSync(logFile, `${JSON.stringify(record)}\n`);
    process.stderr.write(`  detected=${record.detected} missed=${record.missed} misclassified=${record.misclassified}\n`);
  }

  const summary = {
    cases: records.length,
    detected: records.filter((r) => r.detected).length,
    missed: records.filter((r) => r.missed).length,
    misclassified: records.filter((r) => r.misclassified).length,
    logFile: path.relative(ROOT, logFile),
  };
  fs.writeFileSync(path.join(OUT, `${stamp}.summary.json`), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { healer, failureAnalysis, runCase, CASES };
