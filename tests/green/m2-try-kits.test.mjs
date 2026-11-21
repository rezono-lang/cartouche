import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as atlas from '../../packages/atlas/src/index.ts';

// Decision 0012 §3 (12). Kits are Rezono publications (its examples), recorded like fixture 10, not hand-written.

const ROOT = process.cwd();
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

test('M2 [try-kits] 1: entry page offers three recorded Rezono kits (healthcare allowance, tax return, platform) with pinned source commit', () => {
  assert.equal(
    typeof atlas.listTryKits,
    'function',
    'packages/atlas/src/index.ts must export listTryKits() returning the recorded try-kit descriptors.'
  );

  const pin = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'rezono-pin.json'), 'utf8'));
  const kits = atlas.listTryKits();
  assert.ok(Array.isArray(kits) && kits.length >= 3, `Expected at least 3 try kits, got ${kits?.length ?? 0}.`);

  const ids = kits.map((k) => String(k.id ?? ''));
  assert.ok(
    kits.every((k) => k.source?.repository === 'rezono-lang/rezono' && k.source?.commit === pin.pinned_commit),
    `Every try kit must cite a recorded Rezono publication at contracts/rezono-pin.json (${pin.pinned_commit}).`
  );
  assert.ok(
    kits.every((k) => typeof k.fixturePath === 'string' && fs.existsSync(path.join(ROOT, k.fixturePath))),
    `Every try kit must point to an existing recorded fixture file on disk (kits: ${ids.join(', ')}).`
  );
});

test('M2 [try-kits] 2 & 3: each kit opens with a slip link, suppose toggle tips conclusion with <del>/<ins> and turning point, toggling back restores exact hash', () => {
  assert.equal(
    typeof atlas.listTryKits,
    'function',
    'packages/atlas/src/index.ts must export listTryKits().'
  );
  assert.equal(
    typeof atlas.renderTryKit,
    'function',
    'packages/atlas/src/index.ts must export renderTryKit(kitId, options) for one-click try kits.'
  );

  const kits = atlas.listTryKits();
  assert.ok(kits.length >= 3, 'Expected 3 try kits.');

  for (const kit of kits) {
    const baseHtml = atlas.renderTryKit(kit.id, { suppose: false, locale: 'en' });
    assert.match(
      baseHtml,
      /<a\b[^>]*data-proof-ref=/,
      `Kit "${kit.id}" must open on a conclusion with a slip link carrying data-proof-ref.`
    );
    assert.match(
      baseHtml,
      /<button\b[^>]*data-verb="(?:suppose|s)"/,
      `Kit "${kit.id}" must expose a suppose toggle button (button[data-verb="suppose"|"s"]).`
    );

    const supposedHtml = atlas.renderTryKit(kit.id, { suppose: true, locale: 'en' });
    assert.notEqual(
      sha256(supposedHtml),
      sha256(baseHtml),
      `Toggling suppose on kit "${kit.id}" must change the rendered page to the published variant.`
    );
    assert.match(
      supposedHtml,
      /<del\b[^>]*>[\s\S]+?<\/del>/,
      `Supposed variant of kit "${kit.id}" must show the old conclusion value inside <del>.`
    );
    assert.match(
      supposedHtml,
      /<ins\b[^>]*>[\s\S]+?<\/ins>/,
      `Supposed variant of kit "${kit.id}" must show the new conclusion value inside <ins>.`
    );
    if (kit.hasPublishedTurningPoint) {
      assert.match(
        supposedHtml,
        /data-turn="turns"/,
        `Kit "${kit.id}" publishes a turning point and must mark it with data-turn="turns".`
      );
    }

    const restoredHtml = atlas.renderTryKit(kit.id, { suppose: false, locale: 'en' });
    assert.equal(
      sha256(restoredHtml),
      sha256(baseHtml),
      `Toggling suppose back off on kit "${kit.id}" must restore the original page byte-identically.`
    );
  }
});

test('M2 [try-kits] 4: packages remain domain-free under scripts/leak-and-domain-check.mjs', () => {
  const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'leak-and-domain-check.mjs')], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  assert.match(out, /passed|ok|✅/i, 'scripts/leak-and-domain-check.mjs must pass with packages remaining domain-free.');
});
