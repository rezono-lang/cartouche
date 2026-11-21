#!/usr/bin/env node
/**
 * CLI entry point for the TypeScript Compiler API Zero-Compute AST Linter (Decision 0001).
 */

import path from 'node:path';
import { lintDirectory } from './zero-compute-ast.mjs';

const ROOT = process.cwd();
const { fileCount, violations } = lintDirectory(path.join(ROOT, 'packages'), ROOT);

if (violations.length > 0) {
  console.error('❌ zero-compute-ast-lint FAILED:');
  for (const v of violations) {
    console.error(`  - [${v.code}] ${v.file}:${v.line} — ${v.message}`);
  }
  process.exit(1);
}
console.log(`✅ zero-compute-ast-lint passed (${fileCount} package files parsed with oxc-parser ESTree AST).`);
