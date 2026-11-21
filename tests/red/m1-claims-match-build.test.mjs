import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'Claims match what is built: breathing, 60fps, under 250 ms and cryptographic proof per mark leave README, AGENTS, docs and packages unless the same line names a green test that measures or verifies them (issue #23 §1 and §5)',
  waits_on: []
};

// Decision 0012 §2 (5b), issue #23 §1 ("cryptographic proof per mark" is only string references) and §5 (breathing
// sheets, 60 fps and under 250 ms are not built; radial rings are, in ripple-layout.ts). The M4 work of #31 removed the
// README claims; AGENTS.md and a delta-store comment still claim under 250 ms. A claim may stay only on a line that names the green test that
// measures or verifies it, as `tests/green/<id>.test.mjs`, and that test mentions the claim too. Decisions keep their
// history and are not scanned; Decision 0012 supersedes their claims.

const ROOT = process.cwd();
const CLAIMS = [
  { name: 'breathing', re: /\bbreath(e|es|ing)\b/i },
  { name: '60 fps', re: /\b60\s*-?\s*fps\b/i },
  { name: 'under 250 ms', re: /(<\s*|under\s+|below\s+|within\s+)250\s*ms\b/i },
  { name: 'cryptographic proof per mark', re: /\bcryptographic\s+proof\b/i }
];

function files(dir) {
  if (!fs.existsSync(dir)) return [];
  if (fs.statSync(dir).isFile()) return [dir];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...files(full));
    else if (/\.(md|ts|svelte|json|css|html)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const SCANNED = ['README.md', 'AGENTS.md', 'docs', 'packages'].flatMap((p) => files(path.join(ROOT, p)));

function measuredBy(line, claim) {
  for (const m of line.matchAll(/tests\/green\/[\w.-]+\.test\.mjs/g)) {
    const file = path.join(ROOT, m[0]);
    if (fs.existsSync(file) && claim.re.test(fs.readFileSync(file, 'utf8'))) return true;
  }
  return false;
}

test('M1 [claims-match-build]: no unbuilt or unverified claim in README, AGENTS, docs or packages', () => {
  const found = [];
  for (const file of SCANNED) {
    const rel = path.relative(ROOT, file);
    fs.readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        for (const claim of CLAIMS) {
          if (claim.re.test(line) && !measuredBy(line, claim)) found.push(`${rel}:${i + 1} claims "${claim.name}"`);
        }
      });
  }
  assert.deepEqual(found, [], 'claims without a green test that measures or verifies them on the same line');
});
