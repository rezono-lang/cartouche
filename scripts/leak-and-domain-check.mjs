#!/usr/bin/env node
/**
 * Privacy Leak Check & Domain-Free Core Guard (AGENTS.md Rules 3 & 9).
 *  - Ensures zero local machine paths or private repo identifiers leak into public files.
 *  - Ensures packages/* remain 100% domain-neutral (no hardcoded example domain nouns).
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

// Machine paths are generic and live here. Names of private environments never appear in this public repo, not even
// encoded: CI passes them in the secret CARTOUCHE_PRIVATE_PATTERNS, one case-insensitive regular expression per line.
// Anchor each with word boundaries (\b…\b), so a short name never matches inside a hex hash.
const PRIVATE_PATTERNS = [
  /C:\\Users\\/i,
  /\/Users\/[a-z0-9._-]+\//i,
  ...privatePatternsFromEnv(process.env)
];

export function privatePatternsFromEnv(env) {
  const raw = env.CARTOUCHE_PRIVATE_PATTERNS ?? '';
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0 && env.GITHUB_ACTIONS === 'true') {
    // Fail closed in CI: a guard that silently loses its patterns would pass everything.
    // Dependabot runs get no Actions secrets, so they only get a warning.
    if (env.GITHUB_ACTOR === 'dependabot[bot]') {
      console.warn('::warning::CARTOUCHE_PRIVATE_PATTERNS is not available to Dependabot; only machine paths are checked.');
    } else {
      console.error('❌ leak-and-domain-check: the CI secret CARTOUCHE_PRIVATE_PATTERNS is empty or missing.');
      process.exit(1);
    }
  }
  return lines.map((l) => new RegExp(l, 'i'));
}

// Hardcoded domain terms forbidden inside reusable packages/* (allowed only in fixtures/ and tests/).
const DOMAIN_WORDS =
  /\b(keycloak|hubble|zorgtoeslag|belastingdienst|raadsbesluit|subsidy|statutory|income|assets|postgres|vault)\b/i;

export function findDomainWordViolation(text) {
  // Split CamelCase, PascalCase, and snake_case tokens so compileSubsidyReliefScene / incomeCell / assets_cell are caught.
  const normalized = text.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  const match = normalized.match(DOMAIN_WORDS);
  return match ? match[0] : null;
}

// `.rezono-live` is the nightly checkout of Rezono itself, scanned by Rezono's own leak check, not Cartouche's.
function walk(dir, ignore = new Set(['.git', 'node_modules', 'dist', '.rezono-live'])) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignore.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, ignore));
    else if (/\.(ts|mts|js|mjs|json|md|yml|yaml|svelte|css|html)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = walk(ROOT);
const violations = [];

const DOMAIN_FREE_DIRS = ['packages', 'apps'];

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (rel === 'scripts/leak-and-domain-check.mjs') continue;
  const text = fs.readFileSync(file, 'utf8');

  for (const re of PRIVATE_PATTERNS) {
    if (re.test(text)) {
      violations.push(`${rel}: matched private/machine-path pattern ${re}`);
    }
  }
  if (DOMAIN_FREE_DIRS.some((dir) => rel.startsWith(`${dir}/`))) {
    const foundPath = findDomainWordViolation(rel);
    if (foundPath) {
      violations.push(`${rel}: hardcoded domain term "${foundPath}" found in filename inside domain-neutral ${rel.split('/')[0]}/ directory.`);
    }
    const found = findDomainWordViolation(text);
    if (found) {
      violations.push(`${rel}: hardcoded domain term "${found}" found inside domain-neutral ${rel.split('/')[0]}/ directory.`);
    }
  }
}

if (violations.length > 0) {
  console.error('❌ leak-and-domain-check FAILED:\n' + violations.map((v) => `  - ${v}`).join('\n'));
  process.exit(1);
}
console.log(`✅ leak-and-domain-check passed (${files.length} files scanned; packages/ and apps/ 100% domain-free).`);
