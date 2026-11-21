#!/usr/bin/env node
/**
 * CLI entry point for the TypeScript Compiler API Zero-Compute AST Linter (Decision 0001).
 */

import path from 'node:path';
import { lintDirectory } from './zero-compute-ast.mjs';

const ROOT = process.cwd();
const SCAN_DIRS = ['packages', 'apps'];
let fileCount = 0;
const violations = [];
for (const dir of SCAN_DIRS) {
  const res = lintDirectory(path.join(ROOT, dir), ROOT);
  fileCount += res.fileCount;
  violations.push(...res.violations);
}

if (violations.length > 0) {
  console.error('❌ zero-compute-ast-lint FAILED:');
  for (const v of violations) {
    console.error(`  - [${v.code}] ${v.file}:${v.line} — ${v.message}`);
  }
  process.exit(1);
}
console.log(`✅ zero-compute-ast-lint passed (${fileCount} package/app files parsed with oxc-parser ESTree AST).`);
