import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DeltaStore } from '../../packages/reader-core/src/index.ts';
import { createSlipModel, selectSlipVerb } from '../../packages/slip/src/index.ts';

test('@rezono/slip hosts 5-bar micro-prism, [M] levers, [S] Δ=1 worlds, and locks [P] Propose on unsealed stream', () => {
  const fxFlow = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'fixtures', '01-platform-drift.json'), 'utf8'));
  const fxKring = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'fixtures', '03-kring-m1-to-m5-live.json'), 'utf8'));

  const store = new DeltaStore(fxKring.manifest, fxKring.sealed_rows);
  store.applyProvisionalStep('provisional_engine', fxKring.live_provisional_delta.changes);

  const slip = createSlipModel({
    subjectId: 'e-drift-vault',
    proofRef: 'policy:netpol-04#L42',
    seal: store.seal(),
    prism5: fxFlow.slip_enrichment.prism_5,
    missingLevers: fxFlow.slip_enrichment.missing_levers,
    adjacentWorlds: fxFlow.slip_enrichment.adjacent_worlds_delta1
  });

  assert.equal(slip.prism5.length, 5);
  assert.equal(slip.missingLevers.length, 1);
  assert.equal(slip.adjacentWorlds.length, 3);
  assert.equal(slip.proposeAllowed, false);
  assert.equal(slip.proposeBlockedReason, 'propose_locked_unsealed_live_stream');

  const onSuppose = selectSlipVerb(slip, 's');
  assert.equal(onSuppose.activeVerb, 's');
});
