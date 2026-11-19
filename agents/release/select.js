'use strict';

/**
 * Risk-based test selection: map changed files to the tests that prove them.
 *
 * The map is deliberately explicit. A silent gap in a derived map is exactly
 * the failure mode this phase exists to prevent, so the mapping is written down
 * and checked by the simulation rather than inferred from import graphs.
 */

const AREA_TESTS = {
  auth: ['tests/auth.spec.ts'],
  catalog: ['tests/catalog.spec.ts'],
  cart: ['tests/cart.spec.ts'],
  checkout: ['tests/checkout.spec.ts'],
  orders: ['tests/orders.spec.ts'],
  api: ['tests/auth.spec.ts', 'tests/catalog.spec.ts', 'tests/cart.spec.ts', 'tests/checkout.spec.ts', 'tests/orders.spec.ts'],
};

// Files that can affect an area's behaviour.
const FILE_AREAS = {
  'app/server.js': ['api', 'auth', 'catalog', 'cart', 'checkout', 'orders'],
  'app/public/index.html': ['auth', 'catalog', 'cart', 'checkout', 'orders'],
  'tests/fixtures.ts': ['api'],
  'playwright.config.ts': ['api'],
};

const HIGH_RISK = [
  /^app\/server\.js$/,
  /^\.github\//,
  /^mcp\//,
  /^docs\/release-policy\.md$/,
];

function areasFor(files) {
  const areas = new Set();
  for (const file of files) {
    const mapped = FILE_AREAS[file];
    if (mapped) mapped.forEach((a) => areas.add(a));
  }
  return [...areas].sort();
}

function selectTests(files) {
  const areas = areasFor(files);
  const tests = new Set();
  for (const area of areas) (AREA_TESTS[area] || []).forEach((t) => tests.add(t));
  return { areas, tests: [...tests].sort() };
}

function riskOf(files) {
  if (files.some((f) => HIGH_RISK.some((re) => re.test(f)))) return 'high';
  if (files.some((f) => f.startsWith('app/'))) return 'medium';
  return 'low';
}

function decide(files) {
  const selection = selectTests(files);
  const risk = riskOf(files);
  const approver = risk === 'high' ? 'human' : risk === 'medium' ? 'human-on-evidence-pack' : 'reviewer';
  return {
    files,
    areas: selection.areas,
    tests: selection.tests,
    risk,
    approver,
    autoApproved: risk === 'low',
  };
}

module.exports = { selectTests, riskOf, decide, AREA_TESTS, FILE_AREAS };

if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('usage: node agents/release/select.js <changed-file> [...]');
    process.exit(2);
  }
  console.log(JSON.stringify(decide(files), null, 2));
}
