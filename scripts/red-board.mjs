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
  // Decision 0015 §3: an entry that is not a red-test id is an external gate (`rezono-lang/rezono#N`,
  // `devDependency:<name>`, `planner:assertions`). It stays open until a planner PR removes it.
  const isExternalGate = (id) => !/^m\d+-[a-z0-9-]+$/.test(id);
  const unresolvedWaits = waitsOn.filter((id) => isExternalGate(id) || files.some((f) => f.startsWith(id)));
  // Optional RED_META.priority (lower first) orders tasks within a milestone; Decision 0012 puts the proof map first in M2.
  const priorityMatch = text.match(/priority:\s*(\d+)/);
  return {
    id: file.replace(/\.test\.mjs$/, ''),
    file: `tests/red/${file}`,
    milestone: get('milestone'),
    priority: priorityMatch ? Number(priorityMatch[1]) : 100,
    decision: get('decision'),
    summary: get('summary'),
    status: unresolvedWaits.length === 0 ? 'ready' : 'waits',
    waits_on: unresolvedWaits
  };
});

const milestoneNumber = (t) => Number((t.milestone.match(/\d+/) ?? ['99'])[0]);
tasks.sort((a, b) => milestoneNumber(a) - milestoneNumber(b) || a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

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
