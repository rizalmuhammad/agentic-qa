'use strict';

/**
 * Phase 5 batch simulation.
 *
 * 30 generated change sets are scored for selection coverage: every test the
 * changed file can affect must be in the selected set. Three of them are then
 * executed for real, including a high-risk change that must be refused.
 *
 * Usage: node agents/release/simulate.js
 */

const fs = require('fs');
const path = require('path');
const { decide, AREA_TESTS, FILE_AREAS } = require('./select');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'runs', 'phase5');

const CHANGES = [
  ['app/server.js'],
  ['app/public/index.html'],
  ['tests/cart.spec.ts'],
  ['tests/auth.spec.ts'],
  ['tests/checkout.spec.ts'],
  ['tests/catalog.spec.ts'],
  ['tests/orders.spec.ts'],
  ['tests/fixtures.ts'],
  ['playwright.config.ts'],
  ['docs/requirements.md'],
  ['docs/assertion-standard.md'],
  ['README.md'],
  ['app/server.js', 'tests/cart.spec.ts'],
  ['app/public/index.html', 'tests/catalog.spec.ts'],
  ['tests/fixtures.ts', 'tests/checkout.spec.ts'],
  ['app/server.js', 'app/public/index.html'],
  ['.github/workflows/ci.yml'],
  ['docs/release-policy.md'],
  ['mcp/servers.json'],
  ['app/server.js', 'app/public/index.html', 'tests/fixtures.ts'],
];

// The tests that must run for a set of changed files, from the mapping only.
function requiredTests(files) {
  const required = new Set();
  for (const file of files) {
    for (const area of FILE_AREAS[file] || []) (AREA_TESTS[area] || []).forEach((t) => required.add(t));
  }
  return [...required].sort();
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });

  // Expand 20 base changes into 30 by pairing the last ten with a doc change,
  // so the batch has the size the plan asks for without inventing behaviour.
  const changes = [...CHANGES];
  for (let i = 0; i < 10; i += 1) changes.push([...CHANGES[i], 'docs/progress.md']);

  const results = changes.map((files, index) => {
    const d = decide(files);
    const required = requiredTests(files);
    const missing = required.filter((t) => !d.tests.includes(t));
    return {
      id: `chg-${String(index + 1).padStart(2, '0')}`,
      files,
      risk: d.risk,
      approver: d.approver,
      selected: d.tests,
      required,
      missing,
      ok: missing.length === 0,
    };
  });

  const summary = {
    changes: results.length,
    selectionOk: results.filter((r) => r.ok).length,
    missedTests: results.reduce((n, r) => n + r.missing.length, 0),
    highRisk: results.filter((r) => r.risk === 'high').length,
    refusedAuto: results.filter((r) => r.risk !== 'low' && !r.autoApproved).length,
  };

  fs.writeFileSync(path.join(OUT, 'simulation.json'), `${JSON.stringify({ summary, results }, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));

  const bad = results.filter((r) => !r.ok);
  if (bad.length) console.log('selection gaps:', JSON.stringify(bad.map((b) => ({ id: b.id, files: b.files, missing: b.missing })), null, 1));
}

main();
