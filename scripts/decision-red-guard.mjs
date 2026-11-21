#!/usr/bin/env node
/**
 * Rezono Lesson 5 (applied from Commit #1!): Decision-Driven Work Guard.
 *  1. Every decisions/*.md MUST start with a valid YAML head (id, status, milestone, owner).
 *  2. Every tests/red/*.test.mjs MUST export RED_META citing a valid milestone and existing decision file.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DECISIONS_DIR = path.join(ROOT, 'decisions');
const RED_DIR = path.join(ROOT, 'tests', 'red');

const errors = [];
const validDecisions = new Set();

// 1. Validate every decision head
for (const file of fs.readdirSync(DECISIONS_DIR).filter((f) => f.endsWith('.md')).sort()) {
  const full = path.join(DECISIONS_DIR, file);
  const text = fs.readFileSync(full, 'utf8');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    errors.push(`decisions/${file}: missing YAML frontmatter head.`);
    continue;
  }
  const head = match[1];
  for (const field of ['id:', 'status:', 'milestone:', 'owner:']) {
    if (!head.includes(field)) {
      errors.push(`decisions/${file}: YAML head missing required field "${field}".`);
    }
  }
  validDecisions.add(`decisions/${file}`);
}

// 2. Validate every red test cites a valid milestone & decision with head
const redFiles = fs.existsSync(RED_DIR) ? fs.readdirSync(RED_DIR).filter((f) => f.endsWith('.test.mjs')).sort() : [];
for (const file of redFiles) {
  const full = path.join(RED_DIR, file);
  const text = fs.readFileSync(full, 'utf8');
  const decMatch = text.match(/decision:\s*['"](decisions\/[^'"]+\.md)['"]/);
  const msMatch = text.match(/milestone:\s*['"](M\d+)['"]/);
  if (!msMatch) {
    errors.push(`tests/red/${file}: RED_META must declare milestone ('M1'|'M2'|'M3').`);
  }
  if (!decMatch) {
    errors.push(`tests/red/${file}: RED_META must cite a decision file (decisions/XXXX-*.md).`);
  } else if (!validDecisions.has(decMatch[1])) {
    errors.push(`tests/red/${file}: cited decision "${decMatch[1]}" does not exist or lacks a valid head.`);
  }
}

if (errors.length > 0) {
  console.error('❌ decision-red-guard FAILED:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log(`✅ decision-red-guard passed (${validDecisions.size} decisions, ${redFiles.length} red tasks verified).`);
