'use strict';

/** Score the owner's blind labels against the Reviewer's decisions. */
const fs = require('fs');
const path = require('path');
const { buildCases } = require('./run-review');

const ROOT = path.resolve(__dirname, '..', '..');
const blind = path.join(ROOT, 'runs', 'phase4', 'blind');
const labelsFile = path.join(blind, 'labels.json');
const reportFile = path.join(ROOT, 'runs', 'phase4', 'report.json');

if (!fs.existsSync(labelsFile)) {
  console.error('runs/phase4/blind/labels.json is missing. Copy labels.template.json and fill it in.');
  process.exit(2);
}
const labels = JSON.parse(fs.readFileSync(labelsFile, 'utf8'));
const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
const cases = buildCases();
const decisions = new Map(report.results.map((r) => [r.id, r.decision]));

let compared = 0;
let agree = 0;
const rows = [];
cases.forEach((c, index) => {
  const id = `case-${String(index + 1).padStart(2, '0')}`;
  const human = (labels[id] || '').trim();
  if (!human) return;
  compared += 1;
  const reviewer = decisions.get(c.id) || 'unknown';
  const ok = human === reviewer;
  if (ok) agree += 1;
  rows.push({ id, human, reviewer, ok, requirement: c.requirement });
});

console.log(JSON.stringify({ compared, agree, agreement: compared ? Number((agree / compared).toFixed(3)) : null, disagreements: rows.filter((r) => !r.ok) }, null, 2));
