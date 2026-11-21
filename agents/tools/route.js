'use strict';

/**
 * Map a task type to its short procedure.
 *
 * Usage:
 *   node agents/tools/route.js investigate        # print the procedure
 *   node agents/tools/route.js investigate --path # print only the file path
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const ROUTES = {
  investigate: 'skills/investigate.md',
  implement: 'skills/implement.md',
  review: 'skills/review.md',
  heal: 'skills/heal.md',
};

function route(type) {
  const rel = ROUTES[String(type || '').toLowerCase()];
  if (!rel) return null;
  return { type: String(type).toLowerCase(), file: path.join(ROOT, rel) };
}

function main() {
  const [type, flag] = process.argv.slice(2);
  const hit = route(type);
  if (!hit) {
    console.error(`unknown type "${type}". Known: ${Object.keys(ROUTES).join(', ')}`);
    process.exit(2);
  }
  if (!fs.existsSync(hit.file)) {
    console.error(`procedure missing: ${hit.file}`);
    process.exit(2);
  }
  if (flag === '--path') console.log(hit.file);
  else process.stdout.write(fs.readFileSync(hit.file, 'utf8'));
}

if (require.main === module) main();

module.exports = { route, ROUTES };
