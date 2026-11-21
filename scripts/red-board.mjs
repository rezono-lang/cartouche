#!/usr/bin/env node
/**
 * Agent Task Board CLI: reads tests/red/*.test.mjs and reports every open task,
 * its milestone, decision link, dependencies, and ready/waits status.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const RED_DIR = path.join(ROOT, 'tests', 'red');
const asJson = process.argv.includes('--json');

const files = fs.existsSync(RED_DIR)
  ? fs.readdirSync(RED_DIR).filter((f) => f.endsWith('.test.mjs')).sort()
  : [];

const tasks = files.map((file) => {
  const text = fs.readFileSync(path.join(RED_DIR, file), 'utf8');
  const get = (k) => (text.match(new RegExp(`${k}:\\s*['"]([^'"]+)['"]`)) ?? [])[1] ?? '';
  const waitsMatch = text.match(/waits_on:\s*\[([^\]]*)\]/);
  const waitsOn = waitsMatch
    ? waitsMatch[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
    : [];
  const unresolvedWaits = waitsOn.filter((id) => files.some((f) => f.startsWith(id)));
  return {
    id: file.replace(/\.test\.mjs$/, ''),
    file: `tests/red/${file}`,
    milestone: get('milestone'),
    decision: get('decision'),
    summary: get('summary'),
    status: unresolvedWaits.length === 0 ? 'ready' : 'waits',
    waits_on: unresolvedWaits
  };
});

if (asJson) {
  console.log(JSON.stringify({ total: tasks.length, ready: tasks.filter((t) => t.status === 'ready').length, tasks }, null, 2));
} else {
  console.log(`\n📋 CARTOUCHE RED-TEST TASK BOARD (${tasks.length} tasks, ${tasks.filter((t) => t.status === 'ready').length} ready)\n`);
  for (const t of tasks) {
    const icon = t.status === 'ready' ? '🟢 READY' : '⏳ WAITS';
    console.log(`  [${t.milestone}] ${icon}  ${t.id}`);
    console.log(`       decision: ${t.decision}  |  ${t.summary}`);
    if (t.waits_on.length) console.log(`       waits_on: ${t.waits_on.join(', ')}`);
  }
  console.log('');
}
