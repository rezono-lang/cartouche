import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { render } from '../../packages/slip/bin/render.ts';
import { parseHtml } from '../../scripts/svelte-test-harness.mjs';

// Decision 0015 §2 N7, issue #46 point 4, Decision 0013 §3 ("Cartouche reads no field that Rezono does not serve").
// render.ts sealFromReaderHead reads trust_tier, seal.trust_tier, can_propose, rights.can_propose, seal.can_propose,
// provisional_count and seal.provisional_count: names Cartouche guessed, which Rezono's /slip/head does not have.
// A head that carries them must leave the page exactly as it is. When rezono-lang/rezono#1451 lands, a planner
// records the served names and m2-seal-and-rights-from-rezono reads them. Waits on the canPropose task: same code.
// The assertions of tests/green/m4-zero-client-decision-boundary.test.mjs that a guessed trust_tier changes the seal
// moved here, reversed (Decision 0015 §5).

const ROOT = process.cwd();
const FX10 = 'fixtures/10-slip-reader-answers.json';
const REQUEST = { store: 'main', role: 'reader', pack: 'slip', lang: 'en' };
const M = DATA_MARKS;

// Fields that change the seal on main: the page must stay byte-identical.
const GUESSED_TIER = [
  { trust_tier: 'sealed' },
  { trust_tier: 'provisional_engine' },
  { trust_tier: 'not_a_tier' },
  { seal: { trust_tier: 'sealed', can_propose: true, provisional_count: 0 } }
];

// Fields that would grant the right to propose. On main the reader page shows no Propose state at all, so these are
// held through the statement m1-propose-locked-until-served adds: with any of them on the head, the page still says
// propose_locked_no_reader_grant.
const GUESSED_RIGHT = [{ can_propose: true }, { rights: { can_propose: true } }, { seal: { can_propose: true } }, { provisional_count: 0 }];

const digest = (html) => crypto.createHash('sha256').update(html).digest('hex');

function withHead(extra) {
  const fx = JSON.parse(fs.readFileSync(path.join(ROOT, FX10), 'utf8'));
  Object.assign(fx.reader_answers.main.reader['/slip/head'].body, extra);
  return fx;
}

test('M1 [reads-only-served-head-fields]: the recorded head serves trust_tier/may_propose (rezono#1481) and none of the guessed fields', () => {
  const fx = JSON.parse(fs.readFileSync(path.join(ROOT, FX10), 'utf8'));
  for (const [store, roles] of Object.entries(fx.reader_answers)) {
    for (const [role, answers] of Object.entries(roles)) {
      const head = answers['/slip/head'].body;
      assert.equal('trust_tier' in head, true, `${store}/${role}: /slip/head must serve trust_tier (rezono#1481)`);
      assert.equal('may_propose' in head, true, `${store}/${role}: /slip/head must serve may_propose (rezono#1481)`);
      for (const field of ['can_propose', 'rights', 'seal', 'provisional_count']) {
        assert.equal(field in head, false, `${store}/${role}: /slip/head serves ${field}; re-plan this test with the served name`);
      }
    }
  }
});

for (const extra of GUESSED_TIER) {
  test(`M1 [reads-only-served-head-fields]: a head carrying ${JSON.stringify(extra)} leaves the page unchanged`, async () => {
    const baseline = await render({ fixture: FX10, ...REQUEST });
    let html;
    try {
      html = (await render({ fixture: withHead(extra), ...REQUEST })).html;
    } catch (err) {
      assert.fail(`render() reads ${JSON.stringify(extra)} from /slip/head, a field Rezono does not serve, and refuses: ${err.message}`);
    }
    assert.equal(
      digest(html),
      digest(baseline.html),
      `render() reads ${JSON.stringify(extra)} from /slip/head, a field Rezono does not serve, and the page changes (#46 point 4)`
    );
  });
}

for (const extra of GUESSED_RIGHT) {
  test(`M1 [reads-only-served-head-fields]: a head carrying ${JSON.stringify(extra)} still says Propose is not served`, async () => {
    const { window: win, document: doc } = parseHtml((await render({ fixture: withHead(extra), ...REQUEST })).html);
    try {
      for (const b of doc.querySelectorAll(`button[${M.verb}="propose"]`)) assert.equal(b.hasAttribute('disabled'), true);
      assert.ok(
        doc.querySelector(`[${M.reason}="propose_locked_no_reader_grant"]`),
        `with ${JSON.stringify(extra)} on /slip/head the page does not say propose_locked_no_reader_grant: it never says it ` +
          '(m1-propose-locked-until-served), or it reads a right Rezono does not serve (#46 point 4)'
      );
    } finally {
      await win.happyDOM.close();
    }
  });
}
