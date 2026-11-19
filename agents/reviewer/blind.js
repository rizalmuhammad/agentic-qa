'use strict';

/**
 * Export the Reviewer's cases without labels, for an independent human pass.
 *
 * Writes runs/phase4/blind/case-XX.md (requirement + candidate diff, no label)
 * and a labels.json template. The owner fills it and runs score.js.
 */

const fs = require('fs');
const path = require('path');
const { buildCases } = require('./run-review');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'runs', 'phase4', 'blind');

const cases = buildCases();
fs.mkdirSync(OUT, { recursive: true });

const template = {};
cases.forEach((c, index) => {
  const id = `case-${String(index + 1).padStart(2, '0')}`;
  fs.writeFileSync(
    path.join(OUT, `${id}.md`),
    [
      `# ${id}`,
      '',
      `Requirement: ${c.requirement} - ${c.text}`,
      `File under review: ${c.path}`,
      '',
      '## After the change',
      '```ts',
      String(c.after).slice(0, 6000),
      '```',
      '',
      'Verdict: approve / reject / escalate.',
      '',
    ].join('\n'),
  );
  template[id] = '';
});

fs.writeFileSync(
  path.join(OUT, 'labels.template.json'),
  `${JSON.stringify(template, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(OUT, 'README.md'),
  [
    '# Blind label set',
    '',
    `${cases.length} cases, exported without labels.`,
    '',
    '1. Copy `labels.template.json` to `labels.json`.',
    '2. For each case file, read the requirement and the candidate change, and write one verdict: `approve`, `reject`, `escalate`.',
    '3. Run `node agents/reviewer/score-blind.js`.',
    '',
    'Do not open `run-review.js` before labelling; it contains the planted change and the label.',
    '',
  ].join('\n'),
);
console.log(`wrote ${cases.length} blind cases to ${path.relative(ROOT, OUT)}`);
