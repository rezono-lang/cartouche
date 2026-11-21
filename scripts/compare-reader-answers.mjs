#!/usr/bin/env node
/**
 * Compare the committed reader answers (fixtures/10-slip-reader-answers.json) with a fresh recording
 * (Decision 0009, point 3). Prints a Markdown summary and exits 1 when they differ: the Rezono commit, any request
 * added or dropped, and any request whose status or body changed. How and when a fixture was recorded is not compared.
 *
 * Usage: node scripts/compare-reader-answers.mjs <committed.json> <recorded.json>
 */

import fs from 'node:fs';

const [committedPath, recordedPath] = process.argv.slice(2);
const committed = JSON.parse(fs.readFileSync(committedPath, 'utf8'));
const recorded = JSON.parse(fs.readFileSync(recordedPath, 'utf8'));

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
    .join(',')}}`;
}

const lines = [];
if (committed.source?.commit !== recorded.source?.commit) {
  lines.push(`- Rezono commit: committed \`${committed.source?.commit}\`, recorded \`${recorded.source?.commit}\``);
}
const stores = new Set([...Object.keys(committed.reader_answers ?? {}), ...Object.keys(recorded.reader_answers ?? {})]);
for (const store of [...stores].sort()) {
  const a = committed.reader_answers?.[store] ?? {};
  const b = recorded.reader_answers?.[store] ?? {};
  for (const role of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    const x = a[role] ?? {};
    const y = b[role] ?? {};
    for (const p of [...new Set([...Object.keys(x), ...Object.keys(y)])].sort()) {
      const where = `\`${store}/${role}\` \`${p}\``;
      if (!(p in y)) lines.push(`- ${where}: committed, not asked any more`);
      else if (!(p in x)) lines.push(`- ${where}: asked, not committed (status ${y[p].status})`);
      else if (x[p].status !== y[p].status) lines.push(`- ${where}: status ${x[p].status} -> ${y[p].status}`);
      else if (canonical(x[p].body) !== canonical(y[p].body)) lines.push(`- ${where}: body differs`);
    }
  }
}

if (lines.length === 0) {
  console.log('The recorded reader answers equal fixtures/10-slip-reader-answers.json.');
  process.exit(0);
}
console.log(`The reader answers recorded from Rezono differ from fixtures/10-slip-reader-answers.json in ${lines.length} place(s):\n`);
console.log(lines.slice(0, 200).join('\n'));
if (lines.length > 200) console.log(`\n… and ${lines.length - 200} more.`);
process.exit(1);
