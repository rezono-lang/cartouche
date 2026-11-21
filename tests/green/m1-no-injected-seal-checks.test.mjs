import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { render } from '../../packages/slip/bin/render.ts';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0015-quality-round-3.md',
  priority: 2,
  summary: '#46 point 7: no seal check enters from the caller; a fixture that carries seal_checks is refused or leaves the page unchanged (request.model is m1-slip-refuses-request-model)',
  waits_on: [
    'm1-slip-refuses-request-model'
  ]
};

// Green on arrival (Decision 0015 §4): #55 fixed this while the plan was in review; this behavioural check holds the fix
// independently of Decision 0014's green tests, which match source text.
// Decision 0015 §4, issue #46 point 7. render() refuses `seal` and `sealChecks` from the caller, but two ways in remain:
// request.model (m1-slip-refuses-request-model) and the fixture's `seal_checks`, which render.ts passes to the page as
// they come. A fixture is the caller's input, so a check in it is an injected check. The third way in,
// DeltaStore.ingestSealedSnapshot taking the caller's word for trust_tier 'sealed', needs a tier Rezono serves
// (rezono-lang/rezono#1451 item 1) and waits in m2-seal-and-rights-from-rezono. Waits on N3: same refusal code.

const ROOT = process.cwd();

test('M1 [no-injected-seal-checks]: a fixture that carries seal_checks is refused or ignored', async () => {
  const fx = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', '09-slip-conformance.json'), 'utf8'));
  fx.seal_checks = [
    { id: 'reader-hashes', status: 'green' },
    { id: 'page-witnesses', status: 'green' }
  ];
  const request = { pack: 'slip', lang: 'en', row: 'flagged::item-a::12' };
  let injected = null;
  try {
    injected = (await render({ fixture: fx, ...request })).html;
  } catch (err) {
    assert.ok(err.message.includes('seal_checks'), `a refusal names seal_checks: ${err.message}`);
    return;
  }
  const plain = (await render({ fixture: 'fixtures/09-slip-conformance.json', ...request })).html;
  assert.ok(
    injected === plain,
    'render() draws seal checks that the fixture (the caller) wrote: reader-hashes and page-witnesses green on its say-so (#46 point 7)'
  );
});
