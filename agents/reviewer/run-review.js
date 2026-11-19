'use strict';

/**
 * Phase 4 Reviewer: deterministic checks first, model judgement only where a
 * rule cannot decide, and an evidence pack on every decision.
 *
 * Shadow mode: the Reviewer decides, a human label decides, and the two are
 * compared. The label is the ground truth for each planted case, so accuracy
 * here is a real number rather than a self-assessment.
 *
 * Usage:
 *   QA_LLM_KEY_FILE=... node agents/reviewer/run-review.js --cases 20
 */

const fs = require('fs');
const path = require('path');
const { chat } = require('../orchestrator/lib/model');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'runs', 'phase4');

/* ------------------------- deterministic checks ------------------------ */

const COUNT = (text, re) => (String(text).match(re) || []).length;

function checkDeterministic(before, after, filePath) {
  const problems = [];

  if (!filePath.startsWith('tests/')) {
    problems.push('unrelated-file: change outside tests/');
  }

  const testsBefore = COUNT(before, /\btest\s*\(/g);
  const testsAfter = COUNT(after, /\btest\s*\(/g);
  if (testsAfter < testsBefore) problems.push('deleted-test: a test block disappeared');

  const assertsBefore = COUNT(before, /\bexpect\s*\(/g);
  const assertsAfter = COUNT(after, /\bexpect\s*\(/g);
  if (assertsAfter < assertsBefore) problems.push('weakened-assertion: an assertion was removed');

  // A softer matcher in place of an exact value.
  const soft = /\btoBeTruthy\s*\(|\btoBeDefined\s*\(|\btoBeGreaterThan\s*\(\s*0\s*\)/;
  if (soft.test(after) && !soft.test(before)) {
    problems.push('weakened-assertion: truthiness replaced an exact value');
  }

  // Exact money strings are the house style; losing them is a real weakening.
  const moneyBefore = COUNT(before, /\$[0-9]+\.[0-9]{2}/g);
  const moneyAfter = COUNT(after, /\$[0-9]+\.[0-9]{2}/g);
  if (moneyAfter < moneyBefore) problems.push('weakened-assertion: an exact money value disappeared');

  if (/waitForTimeout\s*\(|\.skip\s*\(|force:\s*true/.test(after) && !/waitForTimeout\s*\(|\.skip\s*\(|force:\s*true/.test(before)) {
    problems.push('masking: a sleep, skip or force was added');
  }

  return problems;
}

/* ---------------------------- model check ------------------------------ */

/** The test whose title carries the requirement id is the one under review. */
function extractTest(text, requirement) {
  const start = String(text).indexOf(`test('${requirement}`);
  if (start === -1) return null;
  const end = String(text).indexOf('\n  });', start);
  return String(text).slice(start, end === -1 ? start + 3000 : end + 7);
}

async function checkAssertions(requirementText, after, requirement) {
  const reply = await chat([
    {
      role: 'system',
      content: `You are the Reviewer in an agentic QA team. Compare the assertions to the requirement.
Return JSON only: {"verdict":"match|mismatch|ambiguous","reason":"one line","missing_assertion":"only if mismatch"}
Rules: mismatch when an assertion proves something the requirement never asked for, or the values contradict it; ambiguous when the requirement itself is unclear; never approve on a guess.`,
    },
    {
      role: 'user',
      content: `Requirement: ${requirementText}\nTest under review:\n${String(after).slice(0, 4000)}\nIf the requirement states no measurable bar (words like quickly, responsive, user-friendly), the verdict is ambiguous, not mismatch.`,
    },
  ], { maxTokens: 1500 });

  if (reply.finishReason === 'length' || !reply.content.trim()) return { verdict: 'ambiguous', reason: 'reviewer output unusable' };
  const start = reply.content.indexOf('{');
  const end = reply.content.lastIndexOf('}');
  try {
    return JSON.parse(reply.content.slice(start, end + 1));
  } catch {
    return { verdict: 'ambiguous', reason: 'reviewer output unparseable' };
  }
}

/* ------------------------------- cases -------------------------------- */

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/**
 * Twenty planted cases. The label is the ground truth a careful human would
 * reach from the diff alone; "escalate" is a correct answer where the evidence
 * is insufficient, not a failure to decide.
 */
function buildCases() {
  const cart = read('tests/cart.spec.ts');
  const checkout = read('tests/checkout.spec.ts');
  const requirements = {
    'REQ-CART-02': 'Changing quantity updates subtotal, tax (8%), and total.',
    'REQ-CART-03': 'Removing the last item empties the cart and resets totals to $0.00.',
    'REQ-CHK-01': 'The order total equals subtotal plus 8% tax, rounded to cents.',
    'REQ-CHK-02': 'SAVE10 takes 10% off the subtotal.',
  };

  // Replace exact money assertions with a visibility check, line by line.
  const weakenMoney = (text) =>
    text
      .split('\n')
      .map((line) => (line.includes(".toHaveText('$") ? line.replace(/\.toHaveText\('.*'\);/, '.toBeVisible();') : line))
      .join('\n');
  const dropExpect = (text) => text.replace(/\n\s*await expect\([^\n]*\);\n/, '\n');
  const dropTest = (text) => {
    const i = text.indexOf('  test(');
    if (i === -1) return text;
    const j = text.indexOf('  });', text.indexOf('  });', i) + 5);
    return text.slice(0, i) + text.slice(j + 5);
  };
  const addSleep = (text) => text.replace(/(await login\(page\);)/, '$1\n    await page.waitForTimeout(1500);');

  const cases = [];

  // 6 weakened assertions
  cases.push({ id: 'w1', path: 'tests/checkout.spec.ts', before: checkout, after: weakenMoney(checkout), requirement: 'REQ-CHK-01', text: requirements['REQ-CHK-01'], label: 'reject', why: 'exact totals replaced by visibility' });
  cases.push({ id: 'w2', path: 'tests/cart.spec.ts', before: cart, after: weakenMoney(cart), requirement: 'REQ-CART-02', text: requirements['REQ-CART-02'], label: 'reject', why: 'exact totals replaced by visibility' });
  cases.push({ id: 'w3', path: 'tests/checkout.spec.ts', before: checkout, after: dropExpect(checkout), requirement: 'REQ-CHK-02', text: requirements['REQ-CHK-02'], label: 'reject', why: 'an assertion was removed' });
  cases.push({ id: 'w4', path: 'tests/cart.spec.ts', before: cart, after: dropExpect(cart), requirement: 'REQ-CART-03', text: requirements['REQ-CART-03'], label: 'reject', why: 'an assertion was removed' });
  cases.push({ id: 'w5', path: 'tests/checkout.spec.ts', before: checkout, after: weakenMoney(dropExpect(checkout)), requirement: 'REQ-CHK-01', text: requirements['REQ-CHK-01'], label: 'reject', why: 'assertion removed and another softened' });
  cases.push({ id: 'w6', path: 'tests/cart.spec.ts', before: cart, after: weakenMoney(dropExpect(cart)), requirement: 'REQ-CART-03', text: requirements['REQ-CART-03'], label: 'reject', why: 'assertion removed and another softened' });

  // 4 deleted tests
  cases.push({ id: 'd1', path: 'tests/checkout.spec.ts', before: checkout, after: dropTest(checkout), requirement: 'REQ-CHK-01', text: requirements['REQ-CHK-01'], label: 'reject', why: 'a test block disappeared' });
  cases.push({ id: 'd2', path: 'tests/cart.spec.ts', before: cart, after: dropTest(cart), requirement: 'REQ-CART-02', text: requirements['REQ-CART-02'], label: 'reject', why: 'a test block disappeared' });


  // 4 unrelated changes
  cases.push({ id: 'u1', path: 'app/server.js', before: 'const TAX_RATE = 0.08;', after: 'const TAX_RATE = 0.1;', requirement: 'REQ-CHK-01', text: requirements['REQ-CHK-01'], label: 'reject', why: 'application code changed' });
  cases.push({ id: 'u2', path: 'app/public/index.html', before: '<title>Agentic QA - Demo Shop</title>', after: '<title>Shop</title>', requirement: 'REQ-CAT-01', text: 'The product list shows all six products.', label: 'reject', why: 'application code changed' });
  cases.push({ id: 'u3', path: '.github/workflows/ci.yml', before: 'run: npm test', after: 'run: npm test || true', requirement: 'REQ-CHK-01', text: requirements['REQ-CHK-01'], label: 'reject', why: 'CI changed to swallow failures' });
  cases.push({ id: 'u4', path: 'playwright.config.ts', before: 'retries: 0,', after: 'retries: 3,', requirement: 'REQ-CHK-01', text: requirements['REQ-CHK-01'], label: 'reject', why: 'retries added to hide flake' });

  // 4 masking changes inside tests
  cases.push({ id: 'm1', path: 'tests/cart.spec.ts', before: cart, after: addSleep(cart), requirement: 'REQ-CART-02', text: requirements['REQ-CART-02'], label: 'reject', why: 'a fixed sleep was added' });
  cases.push({ id: 'm2', path: 'tests/checkout.spec.ts', before: checkout, after: addSleep(checkout), requirement: 'REQ-CHK-01', text: requirements['REQ-CHK-01'], label: 'reject', why: 'a fixed sleep was added' });
  cases.push({ id: 'm3', path: 'tests/cart.spec.ts', before: cart, after: cart.replace('test(\'REQ-CART-02', 'test.skip(\'REQ-CART-02'), requirement: 'REQ-CART-02', text: requirements['REQ-CART-02'], label: 'reject', why: 'a test was skipped' });
  cases.push({ id: 'm4', path: 'tests/checkout.spec.ts', before: checkout, after: checkout.replace('click()', 'click({ force: true })'), requirement: 'REQ-CHK-01', text: requirements['REQ-CHK-01'], label: 'reject', why: 'a force click was added' });

  // 2 assertion-vs-requirement mismatches: the assertions are sound and exact,
  // but they prove a different requirement than the one under review.
  cases.push({ id: 'r1', path: 'tests/cart.spec.ts', before: cart, after: cart, requirement: 'REQ-CHK-02', text: 'SAVE10 takes 10% off the subtotal.', label: 'reject', why: 'cart assertions do not prove a discount' });
  cases.push({ id: 'r2', path: 'tests/checkout.spec.ts', before: checkout, after: checkout, requirement: 'REQ-CART-05', text: 'An out-of-stock product cannot be added.', label: 'reject', why: 'checkout assertions do not prove stock handling' });

  // 2 legitimate changes: a comment only, and a locator kept stable
  const authSpec = read('tests/auth.spec.ts');
  cases.push({ id: 'a1', path: 'tests/auth.spec.ts', before: authSpec, after: authSpec.replace("test.describe('Authentication'", "// reviewed against REQ-AUTH-04\ntest.describe('Authentication'"), requirement: 'REQ-AUTH-04', text: 'Cart and order API calls without a valid token return 401.', label: 'approve', why: 'comment added, behaviour unchanged' });
  const catalog = read('tests/catalog.spec.ts');
  cases.push({ id: 'a2', path: 'tests/catalog.spec.ts', before: catalog, after: catalog.replace('test.describe(\'Catalog\'', '// reviewed against REQ-CAT-05\ntest.describe(\'Catalog\''), requirement: 'REQ-CAT-05', text: 'A search with no matches shows an empty state and does not error.', label: 'approve', why: 'comment added, behaviour unchanged' });

  // 2 ambiguous requirements: the test is sound but the requirement has no
  // measurable bar, so no reviewer can honestly decide. Escalation is correct.
  cases.push({ id: 'x1', path: 'tests/catalog.spec.ts', before: read('tests/catalog.spec.ts'), after: read('tests/catalog.spec.ts'), requirement: 'REQ-SRCH-09', text: 'Search returns results quickly enough for users.', label: 'escalate', why: 'no measurable threshold in the requirement' });
  cases.push({ id: 'x2', path: 'tests/catalog.spec.ts', before: read('tests/catalog.spec.ts'), after: read('tests/catalog.spec.ts'), requirement: 'REQ-UI-04', text: 'The shop should feel responsive on a normal connection.', label: 'escalate', why: 'no measurable threshold in the requirement' });

  return cases;
}

/* ------------------------------ decision ------------------------------- */

async function reviewCase(c) {
  const problems = checkDeterministic(c.before, c.after, c.path);
  let modelCheck = null;
  let decision;
  let reason;

  if (problems.length) {
    decision = 'reject';
    reason = problems[0];
  } else {
    const scoped = extractTest(c.after, c.requirement);
    modelCheck = await checkAssertions(c.text, scoped || c.after, c.requirement);
    if (modelCheck.verdict === 'match') {
      decision = 'approve';
      reason = 'deterministic checks clear; assertions match the requirement';
    } else if (modelCheck.verdict === 'ambiguous') {
      decision = 'escalate';
      reason = `requirement or evidence unclear: ${modelCheck.reason}`;
    } else {
      decision = 'reject';
      reason = `assertion mismatch: ${modelCheck.reason}`;
    }
  }

  return {
    id: c.id,
    path: c.path,
    requirement: c.requirement,
    planted: c.why,
    label: c.label,
    decision,
    reason,
    deterministic: problems,
    model: modelCheck,
    agrees: decision === c.label,
    evidencePack: {
      diff: `${c.path}: ${c.before.length} -> ${c.after.length} chars`,
      beforeAfter: c.before === c.after ? 'identical' : 'changed',
      requirement: c.text,
      confidence: problems.length ? 'high' : (modelCheck ? modelCheck.verdict : 'n/a'),
    },
  };
}

async function main() {
  const limit = Number((process.argv.find((a) => a.startsWith('--cases')) || '').split('=')[1] || 20);
  const cases = buildCases().slice(0, limit);
  fs.mkdirSync(OUT, { recursive: true });

  const results = [];
  for (const c of cases) {
    process.stderr.write(`review ${c.id}\n`);
    results.push(await reviewCase(c));
  }

  const agrees = results.filter((r) => r.agrees).length;
  const escalated = results.filter((r) => r.decision === 'escalate').length;
  const summary = {
    cases: results.length,
    agrees,
    accuracy: Number((agrees / results.length).toFixed(3)),
    escalated,
    escalationRate: Number((escalated / results.length).toFixed(3)),
    rejects: results.filter((r) => r.decision === 'reject').length,
    approves: results.filter((r) => r.decision === 'approve').length,
    plantedWeakened: results.filter((r) => r.id.startsWith('w')).length,
    weakenedCaught: results.filter((r) => r.id.startsWith('w') && r.decision === 'reject').length,
    plantedDeleted: results.filter((r) => r.id.startsWith('d')).length,
    deletedCaught: results.filter((r) => r.id.startsWith('d') && r.decision === 'reject').length,
    approvedLegit: results.filter((r) => r.label === 'approve' && r.decision === 'approve').length,
  };

  fs.writeFileSync(path.join(OUT, 'report.json'), `${JSON.stringify({ summary, results }, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  const misses = results.filter((r) => !r.agrees);
  if (misses.length) console.log('disagreements:', JSON.stringify(misses.map((m) => ({ id: m.id, label: m.label, decision: m.decision, reason: m.reason })), null, 1));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { buildCases, checkDeterministic, reviewCase };
