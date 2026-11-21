import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { render } from '../../packages/slip/bin/render.ts';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0015-quality-round-3.md',
  priority: 1,
  summary: 'N3 (#46 point 3): render() refuses a caller-built request.model the same way it refuses seal and sealChecks; the page never takes a caller proposeAllowed',
  waits_on: []
};

// Decision 0015 §2 N3, issue #46 point 3. render() refuses `seal` and `sealChecks` from the caller (Decision 0011), but
// `request.model` is used as given, and Slip.svelte trusts its proposeAllowed. A caller can therefore unlock Propose.
// Fix: refuse `model` the same way as `seal`.

const ROOT = process.cwd();
const FX01 = 'fixtures/01-platform-drift.json';

function forgedModel() {
  const fx = JSON.parse(fs.readFileSync(path.join(ROOT, FX01), 'utf8'));
  return {
    subjectId: 'forged-subject',
    proofRef: 'p:forged',
    activeVerb: 'w',
    proposeAllowed: true,
    proposeBlockedReason: null,
    prism5: fx.slip_enrichment.prism_5,
    missingLevers: fx.slip_enrichment.missing_levers,
    adjacentWorlds: fx.slip_enrichment.adjacent_worlds_delta1
  };
}

test('M1 [slip-refuses-request-model]: render() refuses a caller-built model', async () => {
  let refused = null;
  try {
    await render({ fixture: FX01, pack: 'slip', lang: 'en', model: forgedModel() });
  } catch (err) {
    refused = err;
  }
  assert.ok(
    refused instanceof Error,
    'render() accepted a caller-built model whose proposeAllowed is true: the caller unlocks Propose (#46 point 3)'
  );
  assert.ok(
    refused.message.includes('model') && refused.message.includes('forbidden'),
    `the refusal names the forbidden model, as the seal refusal does: ${refused.message}`
  );
});

test('M1 [slip-refuses-request-model]: a model on the reader path is refused too', async () => {
  let refused = null;
  try {
    await render({
      fixture: 'fixtures/10-slip-reader-answers.json',
      store: 'main',
      role: 'reader',
      pack: 'slip',
      lang: 'en',
      model: forgedModel()
    });
  } catch (err) {
    refused = err;
  }
  assert.ok(refused instanceof Error, 'render() ignores a caller-built model on the reader path instead of refusing it');
  assert.ok(refused.message.includes('model') && refused.message.includes('forbidden'), refused.message);
});
