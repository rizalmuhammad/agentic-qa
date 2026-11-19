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
  if (/from\s+['"]\.\.\/\.\.\/app/.test(content)) problems.push('test imports application code');
  if (/from\s+['"]\.\/fixtures['"]/.test(content)) problems.push("import must be '../fixtures'");
  return { ok: problems.length === 0, problems, filePath, content };
}

module.exports = { extractJson, validateProposal, FORBIDDEN };
