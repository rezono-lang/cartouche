#!/usr/bin/env node
/**
 * Strict Runtime & DevDependency License Guard (aligned with rezono-lang/rezono AGENTS.md).
 * Blocks GPL/AGPL, CC-BY-NC (Cosmograph), and commercial SDKs (tldraw).
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const pin = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'rezono-pin.json'), 'utf8'));
const ALLOWED = new Set(pin.allowed_runtime_licences);

const BANNED_PACKAGES = [
  /^@?cosmograph(\/|$)/i,
  /^cosmos\.gl$/i,
  /^@?tldraw(\/|$)/i
];

const pkgFiles = [
  path.join(ROOT, 'package.json'),
  ...fs.readdirSync(path.join(ROOT, 'packages')).map((d) => path.join(ROOT, 'packages', d, 'package.json'))
].filter((f) => fs.existsSync(f));

const violations = [];
for (const file of pkgFiles) {
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rel = path.relative(ROOT, file);
  if (pkg.license && !ALLOWED.has(pkg.license)) {
    violations.push(`${rel}: package license "${pkg.license}" is not in allowed_runtime_licences.`);
  }
  for (const depName of [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]) {
    if (BANNED_PACKAGES.some((re) => re.test(depName))) {
      violations.push(`${rel}: dependency "${depName}" is banned under Cartouche license policy.`);
    }
  }
}

// Also audit installed top-level packages in node_modules if present
const nmDir = path.join(ROOT, 'node_modules');
let auditedInstalled = 0;
if (fs.existsSync(nmDir)) {
  for (const entry of fs.readdirSync(nmDir)) {
    if (entry.startsWith('.') || entry === '@rezono') continue;
    const dirs = entry.startsWith('@')
      ? fs.readdirSync(path.join(nmDir, entry)).map((s) => path.join(nmDir, entry, s))
      : [path.join(nmDir, entry)];
    for (const d of dirs) {
      const pjson = path.join(d, 'package.json');
      if (!fs.existsSync(pjson)) continue;
      const meta = JSON.parse(fs.readFileSync(pjson, 'utf8'));
      auditedInstalled++;
      const lic = typeof meta.license === 'string' ? meta.license : meta.license?.type ?? 'UNKNOWN';
      if (!ALLOWED.has(lic)) {
        violations.push(`node_modules/${meta.name}: license "${lic}" is not in allowed_runtime_licences.`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error('❌ license-check FAILED:\n' + violations.map((v) => `  - ${v}`).join('\n'));
  process.exit(1);
}
console.log(`✅ license-check passed (${pkgFiles.length} manifests + ${auditedInstalled} installed packages verified).`);
