---
id: 0008-absent-reason-vs-completeness-witness
status: proposed
milestone: M2
owner: core
created: 2026-11-21
---

# Decision 0008: Clarify `data-reason` vs `data-completeness-ref` on `absent` Marks

## Context

During Wave 1 and Wave 2 verification of `@rezono/slip` (`SlipValueCell.svelte`), a specification conflict surfaced between two frozen Wave-0 contracts (`decisions/0007-frozen-contracts-wave-0.md`):

1. **`contracts/data-marks.json`** (`attributes.reason.description`) states:
   > `"Published epistemic reason; mandatory whenever data-state is not known/valid."`
2. **`contracts/server-projections.schema.json`**, **`packages/reader-core/src/opaque.ts`** (`asOpaqueCell`), **`packages/scene-ir/src/geometry-invariants.ts`** (`EPI_ABSENT_NO_SWEEP`), and all four frozen golden fixtures containing `absent` marks (`fixtures/01-platform-drift.json`, `fixtures/03-kring-m1-to-m5-live.json`, `fixtures/08-monge-4d-audit.json`, `fixtures/09-slip-conformance.json`) require `completeness_witness_ref` (`data-completeness-ref`) on `absent` and omit `reason`.

Under Cartouche's Zero Client Compute and epistemic honesty rules (`AGENTS.md` Rules 1 and 5), a component MUST NOT fabricate a client-side `data-reason` (such as `"complete_sweep_absent"`) when the server did not publish one. Conversely, throwing when `absent` lacks `reason` rejects all four frozen golden fixtures.

## Options Considered

### Option A (Recommended): Distinguish `absent` Completeness Witnesses from Epistemic Reasons

Clarify `contracts/data-marks.json` so that:
- `data-reason` is **mandatory** whenever `data-state` is `unknown`, `invalid`, or `not_applicable` (and MUST be published by the server; components throw if missing or whitespace-only).
- `data-completeness-ref` is **mandatory** whenever `data-state` is `absent` (enforced by `asOpaqueCell` and `EPI_ABSENT_NO_SWEEP`).
- `data-reason` on `absent` is **optional**: emitted verbatim whenever published by the server, omitted when not published, and never fabricated by the client.

**Why this fits Cartouche:**
- Matches `contracts/server-projections.schema.json`, `packages/reader-core/src/opaque.ts`, and all four frozen golden fixtures with zero fixture churn.
- Preserves the epistemic distinction in `AGENTS.md` Rule 5: `unknown` (`▨`) explains *why knowledge is missing* (`data-reason`), whereas `absent` (`⦸`) proves *verified non-existence* via a complete sweep (`data-completeness-ref`).
- Matches the current runtime behavior of `packages/slip/src/SlipValueCell.svelte`.

### Option B: Require a Published `reason` on Every `absent` Mark

Keep `contracts/data-marks.json` unchanged and instead require a non-empty published `reason` on every `absent` cell in `contracts/server-projections.schema.json`, `packages/reader-core/src/opaque.ts`, and `fixtures/01`, `03`, `08`, and `09`.

**Trade-offs:**
- Requires coordinated changes to two frozen contracts, `contracts/freeze-lock.json`, `packages/reader-core/src/opaque.ts`, and four golden fixtures.
- Forces Rezono publications to emit redundant prose reasons on every complete-sweep `absent` row even when `completeness_witness_ref` is already the canonical witness.

## Proposed Next Steps (Upon Acceptance)

1. Update `status` in this decision from `proposed` to `accepted`.
2. In a single planner-reviewed contract bump PR:
   - Update `attributes.reason.description` in `contracts/data-marks.json` per Option A.
   - Regenerate `contracts/freeze-lock.json` SHA-256 digests and cite this decision.
   - Verify `npm run fast-check` passes with zero drift.
