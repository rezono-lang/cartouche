#!/usr/bin/env node
/**
 * Single <5s Local Fast-Check Gate (Rezono Lesson 1 & 3).
 * Runs strict tsc --noEmit + TypeScript AST Zero-Compute Lint + Decision Red-Guard +
 * Leak/Domain-Free Guard + License Guard + all Green Foundation, Mutation & Invariant Tests.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const t0 = Date.now();
const ROOT = process.cwd();
const tscBin = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

const greenTests = fs
  .readdirSync(path.join(ROOT, 'tests', 'green'))
  .filter((f) => f.endsWith('.test.mjs'))
  .sort()
  .map((f) => `tests/green/${f}`);

const steps = [
  ['TypeScript Strict Type-Check (tsc --noEmit)', [tscBin, '--noEmit']],
  ['Zero-Compute & Determinism AST Lint', ['scripts/zero-compute-lint.mjs']],
  ['Decision-Driven Red-Guard', ['scripts/decision-red-guard.mjs']],
  ['Privacy Leak & Domain-Free Guard', ['scripts/leak-and-domain-check.mjs']],
  ['Runtime License Policy Guard', ['scripts/license-check.mjs']],
  ['Green Foundation, Mutation & AST Invariant Tests', ['--experimental-strip-types', '--no-warnings', '--test', ...greenTests]]
];

for (const [label, args] of steps) {
  console.log(`\n▶ ${label}`);
  const res = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (res.status !== 0) {
    console.error(`\n❌ fast-check stopped at: ${label}`);
    process.exit(res.status ?? 1);
  }
}

const ms = Date.now() - t0;
console.log(`\n✨ CARTOUCHE FAST-CHECK GREEN in ${(ms / 1000).toFixed(2)}s!`);
