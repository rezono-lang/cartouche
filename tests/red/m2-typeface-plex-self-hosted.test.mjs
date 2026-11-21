import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'One real typeface pair, self-hosted: a sans and a mono (for example IBM Plex Sans and Plex Mono, OFL-1.1) as woff2 files in the repository with their licence text, used by every sheet and the slip, fetched from no third-party host',
  waits_on: [
    'planner:assertions',
    'm1-absent-never-valid-colour',
    'm1-claims-match-build',
    'm1-contrast-wcag-aa',
    'm1-forced-colors-reduced-motion',
    'm1-green-guard-covers-harness',
    'm1-invalid-drawn-everywhere',
    'm1-mark-opens-slip',
    'm1-monge-unknown-and-state-colours',
    'm1-motion-between-epochs',
    'm1-no-borrowed-proof-refs',
    'm1-proof-refs-only-as-served',
    'm1-propose-locked-until-served',
    'm1-reads-only-served-head-fields',
    'm1-sheet-reads-gate-output',
    'm1-slip-all-witnesses',
    'm1-slip-proof-tree',
    'm1-slip-why-not-why-unknown',
    'm1-time-valid-at-known-at',
    'm1-viewer-prerendered-and-guarded',
    'm1-zero-compute-lint-fails-closed'
  ]
};

// Decision 0012 §7. Fonts are assets, not code; OFL-1.1 is allowed for self-hosted font files with their licence next
// to them. Rezono's packs/std-view/key.yaml names system-ui and ui-monospace today: propose the pair there too, so the
// key stays one.

test('M2 [typeface-plex-self-hosted]: one self-hosted sans and mono pair with its licence, used everywhere', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. The font files (woff2) for the sans and the mono, in the weights used, live in the repository with OFL.txt (or the licence of the chosen pair) beside them and an entry in NOTICE.',
      '2. One @font-face per file with a relative url(); no url in packages, docs or built pages points to fonts.googleapis.com, fonts.gstatic.com or any other host.',
      '3. Every sheet, the slip and the specimen use the two families through CSS variables from the std-view tokens; figures (values, hashes, keys) use the mono.',
      '4. scripts/license-check.mjs or a sibling check accepts OFL-1.1 for font files only, and still forbids it for runtime code.'
    ].join('\n')
  );
});
