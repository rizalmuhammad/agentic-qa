'use strict';

/**
 * Shared output checks for every agent that writes test code.
 * The generated file always lives in tests/generated/, so the rules are fixed.
 */

const FORBIDDEN = [
  { pattern: /waitForTimeout\s*\(/, reason: 'waitForTimeout is banned by the assertion standard' },
  { pattern: /\.skip\s*\(/, reason: 'skipping a test needs a written reason and is not allowed here' },
  { pattern: /force:\s*true/, reason: 'force clicks hide a real failure' },
  { pattern: /test\.only\s*\(/, reason: 'test.only hides the rest of the suite' },
];

/**
 * Rule name: self-fixture-assertion.
 *
 * A test may compute values while it builds its own fixture, but it must not
 * assert a property of that arithmetic. `expect((subtotalCents * 8) % 100)
 * .not.toBe(0)` proves something about the test's own setup, so it fails with
 * no bug present and can never detect one. Assertions must read the app's
 * observable output instead, for example toHaveText('$48.60') or a response
 * body field.
 *
 * Heuristic, kept deliberately narrow to avoid false positives:
 *   - the expect subject contains modulo/multiplication (or a numeric
 *     plus/minus), and
 *   - the subject references a local whose initialiser was arithmetic, or
 *     the subject itself is arithmetic over a declared local, and
 *   - the matcher is a property check (not.toBe, toBeGreaterThan, toBe(0),
 *     toBeTruthy, ...) rather than an exact value.
 * `toHaveText('$48.60')` on a locator has no arithmetic subject, so it passes.
 */
const SELF_FIXTURE_RULE = 'self-fixture-assertion';

function maskCode(content) {
  const code = String(content || '');
  const out = code.split('');
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    const next = code[i + 1];
    if (ch === '/' && next === '/') {
      while (i < code.length && code[i] !== '\n') {
        out[i] = ' ';
        i += 1;
      }
    } else if (ch === '/' && next === '*') {
      out[i] = ' ';
      if (i + 1 < code.length) out[i + 1] = ' ';
      i += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) {
        if (code[i] !== '\n') out[i] = ' ';
        i += 1;
      }
      if (i < code.length) {
        out[i] = ' ';
        if (i + 1 < code.length) out[i + 1] = ' ';
        i += 2;
      }
    } else if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      out[i] = ' ';
      i += 1;
      while (i < code.length) {
        const current = code[i];
        if (current === '\\') {
          out[i] = ' ';
          if (i + 1 < code.length) out[i + 1] = ' ';
          i += 2;
          continue;
        }
        if (current === quote) {
          out[i] = ' ';
          i += 1;
          break;
        }
        if (current !== '\n') out[i] = ' ';
        i += 1;
      }
    } else {
      i += 1;
    }
  }
  return out.join('');
}

function declaredLocals(masked) {
  const locals = new Map();
  const pattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*([^;\n]+)/g;
  let match;
  while ((match = pattern.exec(masked))) locals.set(match[1], match[2]);
  return locals;
}

function computedLocals(masked) {
  const locals = declaredLocals(masked);
  const arithmetic = /[%*]|\bMath\./;
  const computed = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, initialiser] of locals) {
      if (computed.has(name)) continue;
      const usesComputed = [...computed].some((other) => new RegExp(`\\b${other}\\b`).test(initialiser));
      if (arithmetic.test(initialiser) || usesComputed) {
        computed.add(name);
        changed = true;
      }
    }
  }
  return computed;
}

function expectCalls(masked) {
  const calls = [];
  const pattern = /\bexpect\s*\(/g;
  let match;
  while ((match = pattern.exec(masked))) {
    const open = masked.indexOf('(', match.index);
    let depth = 0;
    let i = open;
    for (; i < masked.length; i += 1) {
      if (masked[i] === '(') depth += 1;
      else if (masked[i] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const subject = masked.slice(open + 1, i);
    let end = i + 1;
    while (end < masked.length && masked[end] !== ';' && masked[end] !== '\n') end += 1;
    const chain = masked.slice(i + 1, end);
    calls.push({ subject, chain });
    pattern.lastIndex = i + 1;
  }
  return calls;
}

function fixtureAssertionProblems(content) {
  const masked = maskCode(content);
  const computed = computedLocals(masked);
  const locals = declaredLocals(masked);
  const arithmetic = /[%*]|(?:\d\s*[+-]|[+-]\s*\d)/;
  const propertyMatcher = new RegExp(
    [
      '\\.not\\.(?:toBe|toEqual)\\(',
      '\\.(?:toBeGreaterThan|toBeGreaterThanOrEqual|toBeLessThan|toBeLessThanOrEqual)\\(', // eslint-disable-line max-len
      '\\.(?:toBeTruthy|toBeFalsy|toBeNaN|toBeDefined|toBeUndefined|toBeNull|toBeCloseTo)\\(',
      '\\.(?:toBe|toEqual)\\(\\s*(?:0|true|false)\\s*\\)',
    ].join('|'),
  );

  const problems = [];
  for (const { subject, chain } of expectCalls(masked)) {
    if (!propertyMatcher.test(chain)) continue;

    const usesArithmetic = arithmetic.test(subject);
    const names = [...locals.keys()];
    const usesComputed = [...computed].some((name) => new RegExp(`\\b${name}\\b`).test(subject));
    const usesLocal = names.some((name) => new RegExp(`\\b${name}\\b`).test(subject));

    if (!usesComputed && !(usesArithmetic && usesLocal)) continue;

    problems.push(
      `${SELF_FIXTURE_RULE}: assertion tests a computed property of the test's own fixture data instead of the app's observable output; assert the exact value the page or API returns (for example toHaveText('$48.60')), not arithmetic or modulo on values your setup produced`,
    );
  }
  return [...new Set(problems)];
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

function validateProposal(proposal, requirement) {
  const problems = [];
  if (proposal.blocked) return { ok: false, blocked: true, problems: [`blocked: ${proposal.blocked}`] };

  const filePath = String(proposal.path || '');
  if (!/^tests\/generated\/[a-z0-9-]+\.spec\.ts$/.test(filePath)) {
    problems.push(`path must match tests/generated/<slug>.spec.ts, got "${filePath}"`);
  }
  const content = String(proposal.content || '');
  if (!content.includes(requirement)) problems.push(`test title must contain ${requirement}`);
  if (!/\bexpect\s*\(/.test(content)) problems.push('no assertion found');
  for (const rule of FORBIDDEN) if (rule.pattern.test(content)) problems.push(rule.reason);
  problems.push(...fixtureAssertionProblems(content));
  if (/from\s+['"]\.\.\/\.\.\/app/.test(content)) problems.push('test imports application code');
  if (/from\s+['"]\.\/fixtures['"]/.test(content)) problems.push("import must be '../fixtures'");
  return { ok: problems.length === 0, problems, filePath, content };
}

module.exports = {
  extractJson,
  validateProposal,
  fixtureAssertionProblems,
  SELF_FIXTURE_RULE,
  FORBIDDEN,
};
