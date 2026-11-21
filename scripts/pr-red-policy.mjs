#!/usr/bin/env node
/**
 * PR Red-Test & Frozen-Contract Policy Guard (Rezono Lesson / Punt 52).
 * Prevents worker PRs from silently weakening red tests, tampering with frozen contracts,
 * or disarming lint/policy guards without the `planner` label.
 *
 * Rules:
 *  1. Frozen contracts (`contracts/*`) may ONLY be modified in PRs with the `planner` label.
 *  2. Policy/guard scripts (`scripts/zero-compute-*`, `scripts/contract-freeze-*`,
 *     `scripts/decision-red-guard.mjs`, `scripts/pr-red-policy.mjs`, `.github/workflows/red-policy.yml`)
 *     may ONLY be modified in PRs with the `planner` label.
 *  3. Red tests (`tests/red/<id>.test.mjs`):
 *     - Adding or modifying a red test requires the `planner` label.
 *     - Deleting `tests/red/<id>.test.mjs` WITHOUT the `planner` label is permitted ONLY when
 *       the PR simultaneously adds a promoted green test (`tests/green/<id>.test.mjs`) AND
 *       modifies implementation code under `packages/`.
 *  4. Already-merged green tests (`tests/green/*.test.mjs`):
 *     - Adding a new promoted green test (`A`) is permitted for workers.
 *     - Modifying (`M`) or deleting (`D`) an already-merged green test requires the `planner` label
 *       (prevents silent weakening of existing assertions).
 */

import { execFileSync } from 'node:child_process';

const PROTECTED_POLICY_PATHS = new Set([
  'scripts/zero-compute-ast.mjs',
  'scripts/zero-compute-lint.mjs',
  'scripts/contract-freeze-guard.mjs',
  'scripts/contract-validators.mjs',
  'scripts/decision-red-guard.mjs',
  'scripts/pr-red-policy.mjs',
  'scripts/svelte-test-harness.mjs',
  'scripts/leak-and-domain-check.mjs',
  'package.json',
  '.github/workflows/red-policy.yml'
]);

export function evaluatePrPolicy(changes, labels = []) {
  const hasPlanner = labels.map((l) => l.toLowerCase()).includes('planner');
  const violations = [];

  const addedGreenIds = new Set();
  let touchesPackages = false;

  for (const ch of changes) {
    if (ch.path.startsWith('packages/')) touchesPackages = true;
    const gm = ch.path.match(/^tests\/green\/(.+)\.test\.mjs$/);
    if (gm && (ch.status === 'A' || ch.status === 'M' || ch.status.startsWith('R'))) {
      addedGreenIds.add(gm[1]);
    }
  }

  for (const ch of changes) {
    if (ch.path.startsWith('contracts/') && !hasPlanner) {
      violations.push(
        `Frozen contract "${ch.path}" cannot be modified without the "planner" label (Decision 0007).`
      );
    }

    if (PROTECTED_POLICY_PATHS.has(ch.path) && !hasPlanner) {
      violations.push(
        `Protected guard/policy file "${ch.path}" cannot be modified without the "planner" label.`
      );
    }

    const gm = ch.path.match(/^tests\/green\/(.+)\.test\.mjs$/);
    if (gm && !hasPlanner && ch.status !== 'A') {
      violations.push(
        `Already-merged green test "${ch.path}" (${ch.status}) cannot be modified or deleted without the "planner" label (prevents silent assertion weakening).`
      );
    }

    const rm = ch.path.match(/^tests\/red\/(.+)\.test\.mjs$/);
    if (rm && !hasPlanner) {
      const id = rm[1];
      if (ch.status === 'D') {
        if (!addedGreenIds.has(id) || !touchesPackages) {
          violations.push(
            `Worker deleted red test "${ch.path}" without promoting it to "tests/green/${id}.test.mjs" alongside implementation changes under packages/.`
          );
        }
      } else {
        violations.push(
          `Red test "${ch.path}" (${ch.status}) cannot be added or weakened without the "planner" label. Workers promote red tests to tests/green/ once implemented.`
        );
      }
    }
  }

  return violations;
}

function parseGitNameStatus(output) {
  const entries = [];
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split('\t');
    const status = parts[0];
    if (status.startsWith('R') && parts.length >= 3) {
      entries.push({ status: 'D', path: parts[1] });
      entries.push({ status: 'A', path: parts[2] });
    } else if (parts.length >= 2) {
      entries.push({ status, path: parts[1] });
    }
  }
  return entries;
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('pr-red-policy.mjs')) {
  const base = process.env.PR_BASE_SHA || 'HEAD~1';
  const head = process.env.PR_HEAD_SHA || 'HEAD';
  const labels = (process.env.PR_LABELS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const out = execFileSync('git', ['diff', '--name-status', `${base}...${head}`], { encoding: 'utf8' });
  const changes = parseGitNameStatus(out);
  const violations = evaluatePrPolicy(changes, labels);

  if (violations.length > 0) {
    console.error('❌ pr-red-policy FAILED:\n' + violations.map((v) => `  - ${v}`).join('\n'));
    process.exit(1);
  }
  console.log(`✅ pr-red-policy passed (${changes.length} changed path(s), planner=${labels.includes('planner')}).`);
}
