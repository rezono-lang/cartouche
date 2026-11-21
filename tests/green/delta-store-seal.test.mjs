import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DeltaStore } from '../../packages/reader-core/src/index.ts';

test('Z-set DeltaStore two-layer state + 3-tier CartoucheSeal locks Propose on live provisional_engine', () => {
  const fx = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'fixtures', '03-kring-m1-to-m5-live.json'), 'utf8')
  );
  const store = new DeltaStore(fx.manifest, fx.sealed_rows);

  // Initially sealed. Whether Propose is allowed is the reader's to serve, not DeltaStore's to compute:
  // tests/red/m1-propose-locked-until-served (Decision 0015 §5).
  const seal1 = store.seal();
  assert.equal(seal1.trustTier, 'sealed');
  assert.equal(seal1.provisionalCount, 0);

  // Apply live <250ms provisional_engine delta -> Propose MUST lock!
  store.applyProvisionalStep('provisional_engine', fx.live_provisional_delta.changes);
  const seal2 = store.seal();
  assert.equal(seal2.trustTier, 'provisional_engine');
  assert.equal(seal2.provisionalCount, 1);
  assert.equal(seal2.canPropose, false);
  assert.equal(store.rows().some((r) => r.row.key === 'step:worker-07' && r.layer === 'provisional'), true);

  // Client MUST NOT have a self-sealing method (only Rezono seals rounds, Decision 0011).
  assert.equal('sealProvisionalAsRound' in store, false, 'DeltaStore must not expose client self-sealing');

  // Ingest server-sealed round m-5 snapshot -> server-sealed rows replace the sealed layer.
  const sealedM5Rows = [...fx.sealed_rows, ...fx.live_provisional_delta.changes.map((c) => c.row)];
  store.ingestSealedSnapshot(
    {
      ...fx.manifest,
      id: 'sha256:sealed-round-m5',
      epoch: 43,
      trust_tier: 'sealed'
    },
    sealedM5Rows
  );
  const seal3 = store.seal();
  assert.equal(seal3.trustTier, 'sealed');
  assert.equal(seal3.provisionalCount, 0);
  assert.equal(store.rows().some((r) => r.row.key === 'step:worker-07' && r.layer === 'sealed'), true);
});
