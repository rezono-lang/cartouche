#!/usr/bin/env node
/**
 * Self-hosted font asset license guard (Decision 0012 §7 / m2-typeface-plex-self-hosted).
 * Permits OFL-1.1 strictly for self-hosted .woff2 font assets accompanied by an adjacent OFL.txt,
 * while keeping OFL-1.1 forbidden for runtime code in contracts/rezono-pin.json.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const IGNORED = new Set(['.git', 'node_modules', 'dist', 'coverage']);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const pin = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'rezono-pin.json'), 'utf8'));
const violations = [];

if (pin.allowed_runtime_licences.includes('OFL-1.1')) {
  violations.push('contracts/rezono-pin.json must NOT include OFL-1.1 in allowed_runtime_licences (runtime code only).');
}

const woff2Files = walk(ROOT).filter((f) => f.toLowerCase().endsWith('.woff2'));
if (woff2Files.length === 0) {
  violations.push('No self-hosted .woff2 font files found in repository.');
}

for (const fontPath of woff2Files) {
  const rel = path.relative(ROOT, fontPath).replace(/\\/g, '/');
  if (fs.statSync(fontPath).size === 0) {
    violations.push(`${rel}: font file is empty.`);
  }
  const oflPath = path.join(path.dirname(fontPath), 'OFL.txt');
  if (!fs.existsSync(oflPath)) {
    violations.push(`${rel}: missing adjacent OFL.txt licence file.`);
  } else {
    const licText = fs.readFileSync(oflPath, 'utf8');
    if (!/SIL Open Font License/i.test(licText)) {
      violations.push(`${path.relative(ROOT, oflPath)}: must contain the SIL Open Font License (OFL-1.1) text.`);
    }
  }
}

if (violations.length > 0) {
  console.error('❌ font-license-check FAILED:\n' + violations.map((v) => `  - ${v}`).join('\n'));
  process.exit(1);
}

console.log(`✅ font-license-check passed (${woff2Files.length} .woff2 font asset(s) verified with adjacent OFL.txt; OFL-1.1 scoped to .woff2 only).`);
