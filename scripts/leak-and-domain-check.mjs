#!/usr/bin/env node
/**
 * Privacy Leak Check & Domain-Free Core Guard (AGENTS.md Rules 3 & 9).
 *  - Ensures zero local machine paths or private repo identifiers leak into public files.
 *  - Ensures packages/* remain 100% domain-neutral (no hardcoded example domain nouns).
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

// Encoded private-environment patterns so this public guard never echoes private strings literally.
const PRIVATE_PATTERNS = [
  /C:\\Users\\/i,
  /\/Users\/[a-z0-9._-]+\//i,
  new RegExp(Buffer.from('ZGMzMA==', 'base64').toString('utf8'), 'i'),
  new RegExp(Buffer.from('c2NhbGRlcw==', 'base64').toString('utf8'), 'i')
];

// Hardcoded domain terms forbidden inside reusable packages/* (allowed only in fixtures/ and tests/).
const DOMAIN_WORDS =
  /\b(keycloak|hubble|zorgtoeslag|belastingdienst|raadsbesluit|subsidy|income|assets|postgres|vault)\b/i;

export function findDomainWordViolation(text) {
  // Split CamelCase, PascalCase, and snake_case tokens so compileSubsidyReliefScene / incomeCell / assets_cell are caught.
  const normalized = text.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  const match = normalized.match(DOMAIN_WORDS);
  return match ? match[0] : null;
}

function walk(dir, ignore = new Set(['.git', 'node_modules', 'dist'])) {
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

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (rel === 'scripts/leak-and-domain-check.mjs') continue;
  const text = fs.readFileSync(file, 'utf8');

  for (const re of PRIVATE_PATTERNS) {
    if (re.test(text)) {
      violations.push(`${rel}: matched private/machine-path pattern ${re}`);
    }
  }
  if (rel.startsWith('packages/')) {
    const found = findDomainWordViolation(text);
    if (found) {
      violations.push(`${rel}: hardcoded domain term "${found}" found inside domain-neutral package.`);
    }
  }
}

if (violations.length > 0) {
  console.error('❌ leak-and-domain-check FAILED:\n' + violations.map((v) => `  - ${v}`).join('\n'));
  process.exit(1);
}
console.log(`✅ leak-and-domain-check passed (${files.length} files scanned; packages/ 100% domain-free).`);
