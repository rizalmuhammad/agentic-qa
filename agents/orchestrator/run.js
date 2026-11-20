'use strict';

/**
 * Phase 2 loop: read one known case, ask the model for a Playwright test,
 * validate it, run it, and score the run.
 *
 * Scope rules enforced in code, not in the prompt:
 *   - the model may only produce a file under tests/generated/
 *   - the file must be a .spec.ts, must name the requirement, and must not use
 *     sleeps, skips, force-clicks, or touch application code
 *   - at most one repair attempt per run, then the run is scored and the loop
 *     stops (no unbounded retrying, no guessing)
 *
 * Usage:
 *   QA_LLM_KEY_FILE=/path/to/key node agents/orchestrator/run.js --case search-filter --runs 5
 *   node agents/orchestrator/run.js --all --runs 5 --two-step --port 4110
 *
 * --two-step asks for a short JSON plan first and then writes the test from
 * that plan, so a long case cannot lose its assertions in one truncated reply.
 * Validation and scoring are identical in both modes.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { chat, MODEL } = require('./lib/model');
const { fixtureAssertionProblems } = require('./lib/validate');

const ROOT = path.resolve(__dirname, '..', '..');
const GENERATED = path.join(ROOT, 'tests', 'generated');
const RUN_DIR = path.join(ROOT, 'runs');

const CASES = {
  'search-filter': {
    requirement: 'REQ-CAT-02',
    text: 'Searching by product name filters the list to matching products.',
    hint: 'Use the search input, type "lamp", expect exactly one product card and that it shows Lumen Desk Lamp.',
  },
  'cart-remove': {
    requirement: 'REQ-CART-03',
    text: 'Removing the last item empties the cart and resets totals to $0.00.',
    hint: 'Seed one item through the API, open the cart, click remove, expect no cart rows and $0.00 in subtotal, tax and total.',
  },
  'checkout-discount': {
    requirement: 'REQ-CHK-02',
    text: 'SAVE10 takes 10% off the subtotal.',
    hint: 'Seed a two-item cart through the API, open checkout, apply SAVE10, place the order, assert discount and total exactly.',
  },
  'auth-wrong-password': {
    requirement: 'REQ-AUTH-02',
    text: 'A wrong password shows an error and does not sign the user in.',
    hint: 'Open the login page, submit a wrong password, expect the error box to be visible with "invalid credentials" and the page to stay on login.',
  },
};

const FORBIDDEN = [
  { pattern: /waitForTimeout\s*\(/, reason: 'waitForTimeout is banned by the assertion standard' },
  { pattern: /\.skip\s*\(/, reason: 'skipping a test needs a written reason and is not allowed here' },
  { pattern: /force:\s*true/, reason: 'force clicks hide a real failure' },
  { pattern: /test\.only\s*\(/, reason: 'test.only hides the rest of the suite' },
];

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? true;
}

function readIfExists(relative) {
  const file = path.join(ROOT, relative);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function systemPrompt() {
  return `You are the Generator in an agentic QA team. You write one Playwright + TypeScript test for one requirement.

Hard rules:
- Output the JSON object as your first and only content. No explanation before or after it. \n- Keep the test body short: no comments longer than one line.\n- Shape {"path": "tests/generated/<slug>.spec.ts", "content": "<file body>"}.
- The test title must contain the requirement id, for example "REQ-CAT-02 ...".
- Assert exact values. No truthiness checks. No waitForTimeout. No test.skip. No force clicks. No test.only.
- Never assert a property of your own fixture arithmetic. Do not write expect() around a value you computed from setup, such as expect((subtotalCents * 8) % 100).not.toBe(0) or expect(computedTotal).toBeGreaterThan(0). Assert only what the app returns: the visible text, a response status, or a field from the response body (for example toHaveText('$48.60') or expect(body.total).toBe(48.6)).
- seedCart() signs in through the API and returns an API token; it does NOT sign the browser in. A UI test still needs login(page), and a cart seeded with seedCart's token is not the cart the browser shows. For a UI test, use addToCartViaApi(page, productId, qty) after login(page).
- Import helpers from '../fixtures' (the file is tests/generated/<slug>.spec.ts), and use the data-testid selectors from the contract.
- Use only the routes, product ids, prices and test ids listed in the contract. Never invent a control, test id, product or price.
- Never edit application code, configuration, or other tests.
- If the requirement cannot be tested as written, output {"path": "", "content": "", "blocked": "<why>"}.

Style reference (a passing test from this repo):
${readIfExists('tests/catalog.spec.ts')}

Selectors and routes:
${readIfExists('docs/CONTRACT.md')}

Assertion standard:
${readIfExists('docs/assertion-standard.md')}`;
}

function userPrompt(name, testCase, repairNote, plan) {
  const planBlock = plan
    ? `\nPlan to follow exactly (assertions must prove these, setup must follow this order):\n${JSON.stringify(plan, null, 2)}`
    : '';
  const base = `Requirement: ${testCase.requirement} - ${testCase.text}
Case: ${name}
Hint: ${testCase.hint}
Helpers available: tests/fixtures.ts exports login(page), seedCart(request, items), apiLogin(request), addToCartViaApi(page, productId, qty), expect, test.${planBlock}`;
  if (!repairNote) return base;
  return `${base}

Your previous output was rejected by the harness:
${repairNote}
Return a corrected JSON object only.`;
}

function planPrompt(name, testCase) {
  return `Requirement: ${testCase.requirement} - ${testCase.text}
Case: ${name}
Hint: ${testCase.hint}
Helpers available: tests/fixtures.ts exports login(page), seedCart(request, items), apiLogin(request), addToCartViaApi(page, productId, qty), expect, test.`;
}

function planSystemPrompt() {
  return `You are the Planner in an agentic QA team. Plan one Playwright test before it is written.
Return JSON only, as short as possible:
{"assertions":["one line per assertion: the exact value or state it will prove"],"setup":["one line per setup step"]}
Rules:
- 2-5 assertions. Each assertion names an exact value the app returns, such as "$48.60" or 48.6, not "the total is correct".
- Assertions are about the app's observable output. Never plan an assertion about arithmetic or modulo on values the test computed from its own setup.
- Setup lists the steps in order, including which helper (login, seedCart, apiLogin, addToCartViaApi) and which API calls or page routes.
- seedCart signs in through the API with its own token; its cart is not the browser's cart. For a UI test, call login(page) and then addToCartViaApi(page, productId, qty). Use seedCart only for an API-level test that reuses the token it returns.
- Use only the routes, products and data-testid values listed in the contract below. Never invent a control, test id, product or price.
- The SAVE10 code is typed into the discount field and applied when the order is placed; there is no separate Apply button. Assert the discount and final total on order-confirmation after placing the order; order-total on #/checkout is the pre-discount total.
- No test code, no prose outside the JSON object.

Contract (routes, helpers and selectors):
${readIfExists('docs/CONTRACT.md')}`;
}

async function makePlan(name, testCase) {
  const reply = await chat(
    [
      { role: 'system', content: planSystemPrompt() },
      { role: 'user', content: planPrompt(name, testCase) },
    ],
    { maxTokens: 1500 },
  );
  if (reply.finishReason === 'length') throw new Error('plan reply hit the token cap');
  const plan = extractJson(reply.content);
  const assertions = Array.isArray(plan.assertions) ? plan.assertions : null;
  const setup = Array.isArray(plan.setup) ? plan.setup : null;
  if (!assertions || assertions.length === 0) throw new Error('plan must contain a non-empty "assertions" array');
  if (!setup) throw new Error('plan must contain a "setup" array');
  return { plan: { assertions, setup }, usage: reply.usage, latencyMs: reply.latencyMs };
}

function extractJson(raw) {
  const text = String(raw || '').trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('no JSON object in the reply');
  return JSON.parse(candidate.slice(start, end + 1));
}

function validate(proposal, testCase, name) {
  const problems = [];
  if (proposal.blocked) return { ok: false, blocked: true, problems: [`model blocked: ${proposal.blocked}`] };

  const filePath = String(proposal.path || '');
  if (!/^tests\/generated\/[a-z0-9-]+\.spec\.ts$/.test(filePath)) {
    problems.push(`path must match tests/generated/<slug>.spec.ts, got "${filePath}"`);
  }
  const content = String(proposal.content || '');
  if (!content.includes(testCase.requirement)) {
    problems.push(`test title must contain ${testCase.requirement}`);
  }
  if (!/\bexpect\s*\(/.test(content)) problems.push('no assertion found');
  for (const rule of FORBIDDEN) {
    if (rule.pattern.test(content)) problems.push(rule.reason);
  }
  problems.push(...fixtureAssertionProblems(content));
  if (/from\s+['"]\.\.\/\.\.\/app/.test(content)) problems.push('test imports application code');
  // Generated files live in tests/generated/, so fixtures are one level up.
  if (/from\s+['"]\.\/fixtures['"]/.test(content)) problems.push("import must be '../fixtures', not './fixtures' (file lives in tests/generated/)");
  return { ok: problems.length === 0, problems, filePath, content };
}

function runTest(filePath) {
  const port = String(arg('port', process.env.QA_PORT || process.env.PORT || '3100'));
  const started = Date.now();
  const result = spawnSync(
    'npx',
    ['playwright', 'test', filePath, '--reporter=line'],
    {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 180_000,
      env: { ...process.env, PORT: port },
    },
  );
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  return {
    exitCode: result.status,
    passed: result.status === 0,
    durationMs: Date.now() - started,
    outputTail: output.split('\n').filter(Boolean).slice(-6).join(' | '),
  };
}

async function runOnce(name, testCase, runId, options = {}) {
  const record = {
    runId,
    case: name,
    requirement: testCase.requirement,
    model: MODEL,
    mode: options.twoStep ? 'two-step' : 'one-step',
    startedAt: new Date().toISOString(),
    attempts: 0,
    valid: false,
    passed: false,
    correct: false,
    tokens: 0,
    latencyMs: 0,
    failure: null,
    file: null,
  };

  let plan = null;
  if (options.twoStep) {
    try {
      const planned = await makePlan(name, testCase);
      plan = planned.plan;
      record.plan = plan;
      const planDir = path.join(RUN_DIR, 'plans');
      fs.mkdirSync(planDir, { recursive: true });
      const planName = `${runId}-${Date.now()}.json`;
      fs.writeFileSync(path.join(planDir, planName), `${JSON.stringify(plan, null, 2)}\n`);
      record.planFile = path.relative(ROOT, path.join(planDir, planName));
      record.tokens += planned.usage.total_tokens || 0;
      record.latencyMs += planned.latencyMs;
    } catch (error) {
      record.failure = `plan error: ${error.message}`;
      return record;
    }
  }

  let repairNote = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    record.attempts = attempt;
    let reply;
    try {
      reply = await chat([
        { role: 'system', content: systemPrompt() },
        { role: 'user', content: userPrompt(name, testCase, repairNote, plan) },
      ]);
    } catch (error) {
      record.failure = `model error: ${error.message}`;
      return record;
    }

    record.tokens += reply.usage.total_tokens || 0;
    record.latencyMs += reply.latencyMs;

    let proposal;
    try {
      if (reply.finishReason === 'length') {
        throw new Error('reply hit the token cap; return the JSON object only, with no explanation and no comments in the code');
      }
      proposal = extractJson(reply.content);
    } catch (error) {
      repairNote = error.message;
      record.failure = `unparseable reply: ${error.message}`;
      continue;
    }

    const check = validate(proposal, testCase, name);
    if (!check.ok) {
      repairNote = check.problems.join('; ');
      record.failure = repairNote;
      continue;
    }

    record.valid = true;
    record.file = check.filePath;
    fs.mkdirSync(GENERATED, { recursive: true });
    fs.writeFileSync(path.join(ROOT, check.filePath), check.content);

    const result = runTest(check.filePath);
    record.passed = result.passed;
    record.correct = result.passed;
    record.durationMs = result.durationMs;
    record.outputTail = result.outputTail;
    if (!result.passed) record.failure = 'generated test failed';
    break;
  }

  return record;
}

async function main() {
  const runs = Number(arg('runs', 1));
  const all = Boolean(arg('all', false));
  const single = arg('case');
  const twoStep = Boolean(arg('two-step', false));
  const names = all ? Object.keys(CASES) : [single];

  if (!names[0] || !CASES[names[0]]) {
    console.error(`Pick --case <${Object.keys(CASES).join('|')}> or --all`);
    process.exit(2);
  }

  fs.mkdirSync(RUN_DIR, { recursive: true });
  const tag = arg('tag', '');
  const stamp = `${new Date().toISOString().replace(/[:.]/g, '-')}${tag ? `-${tag}` : ''}`;
  const logFile = path.join(RUN_DIR, `${stamp}.jsonl`);
  const records = [];

  for (const name of names) {
    for (let i = 0; i < runs; i += 1) {
      const runId = `${name}-${i + 1}`;
      process.stderr.write(`running ${runId}${twoStep ? ' (two-step)' : ''}\n`);
      const record = await runOnce(name, CASES[name], runId, { twoStep });
      records.push(record);
      fs.appendFileSync(logFile, `${JSON.stringify(record)}\n`);
      process.stderr.write(
        `  ${record.correct ? 'correct' : 'incorrect'} (valid=${record.valid} passed=${record.passed} attempts=${record.attempts})\n`,
      );
    }
  }

  const correct = records.filter((r) => r.correct).length;
  const total = records.length;
  const streak = longestStreak(records);
  const summary = {
    logFile: path.relative(ROOT, logFile),
    mode: twoStep ? 'two-step' : 'one-step',
    runs: total,
    correct,
    correctRate: total ? Number((correct / total).toFixed(3)) : 0,
    longestCorrectStreak: streak,
    tokens: records.reduce((sum, r) => sum + r.tokens, 0),
    meanLatencyMs: total ? Math.round(records.reduce((s, r) => s + r.latencyMs, 0) / total) : 0,
  };
  fs.writeFileSync(path.join(RUN_DIR, `${stamp}.summary.json`), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

function longestStreak(records) {
  let best = 0;
  let current = 0;
  for (const record of records) {
    current = record.correct ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
