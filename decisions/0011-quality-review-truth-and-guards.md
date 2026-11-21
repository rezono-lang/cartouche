---
id: 0011-quality-review-truth-and-guards
status: accepted
milestone: M4
owner: core
created: 2026-11-21
---

# Decision 0011: Milestone M4 — Quality Review Truth, Client-Boundary, Guard & Honesty Remediation (Issue #23)

## Context

The periodic quality review of Cartouche at commit `3badfee` (GitHub Issue #23: *"Quality review 21-11: green but not yet true"*) identified 27 concrete defects across five areas (§1–§5) where tests and CI were green without the underlying guarantees being true:

- **§1 (Rezono's principles: unknown, absent, invalid and proof):** absent round dots painted green on Monge; Sheet 05 unknown rendered with magnitude `z = 1`; `invalid` (`!`) rejected or omitted from sheets and specimen coverage; Kringstand ignoring `+1`/`-1` weights so retractions render as rows; borrowed proof references across drift edges, live rounds, and Monge round dots; unverified "cryptographic proof per mark" claim in `README.md`; `renderFigure` emitting non-contract signs (`hatch`, `replaced`); inverted stated/observed solid-vs-dashed line conventions between Sheet 02 and Sheet 06.
- **§2 (Cartouche deciding what Rezono decides):** `renderFromReader` hard-coding `trustTier: 'sealed'` and deriving `canPropose`; fixture path projecting `role === 'summary'` stops client-side; callers able to inject `seal` and `sealChecks`; `DeltaStore.sealProvisionalAsRound` self-sealing provisional rows; ~10 reader computations documented in `packages/slip/src/model.ts` running in Cartouche rather than Rezono's gate/publisher or build-time scene compilers.
- **§3 (Data source):** sheets reading only hand-written fixtures (`ReaderClient` unused outside its own test); `.github/workflows/nightly-live.yml` never checking out Rezono to regenerate `fixtures/10-slip-reader-answers.json`; two Rezono commit pins (`bce08a52` and `f15c89d`); frozen contracts out of sync with Rezono `packs/std-view`.
- **§4 (Tests that check little):** `role-zero-leak.test.mjs` testing a pre-stripped fixture instead of rendering complete-role data as a restricted role; `verifySpecimenCoverage()` checking counts instead of per-sign and per-state coverage; xD and geometry tests checking compiler-set constants/grid boxes rather than drawn layout; `zero-compute-lint` missing `z_norm`, `bar_units`, `dependent_count`, CSS `calc(...)`, and allowing `@cartouche-geometry-sort` opt-outs; `pr-red-policy.mjs` not guarding edits to already-merged `tests/green/` files; `axe-core` running with `color-contrast` disabled while `inkFaint` (4.16:1), `hatch` (3.75:1), and obsidian `hatch` (2.57:1) fail WCAG AA.
- **§5 (Claims that are not built):** unbuilt claims (breathing sheets, 60 fps, <250 ms, unused `three`/`@threlte/core` 3D dependencies, radial rings); duplicate hard-coded palette in `ripple-pixi.ts`; domain words (`compileSubsidyReliefScene`, `income_cell`, `assets_cell`) in `packages/` missed by `leak-and-domain-check.mjs` (which misses CamelCase); hard-coded English prose and raw `snake_case` reason codes in sheets instead of Rezono MF2 messages.

Two §3 findings — unifying the single Rezono commit pin (`contracts/rezono-pin.json` == `packages/slip/rezono-source.json`) and syncing frozen contracts (`std-view.v2.tokens.json`, `data-marks.json`, `cartouche-scene.v2.schema.json`, `server-projections.schema.json`) with Rezono `packs/std-view` — are already owned by `m3-std-view-matches-rezono` (Decision 0009).

## Decision

Every remaining finding from Issue #23 becomes a red test first (`tests/red/m4-*.test.mjs`), then an implementation PR. Existing green tests MUST NOT be loosened. Work is partitioned into four **non-overlapping** M4 tasks with disjoint file ownership:

| Task ID | Issue #23 Coverage | Primary File Ownership (Non-Overlapping) | Dependencies |
| --- | --- | --- | --- |
| `m4-epistemic-marks-and-proofs` | §1 (7 bullets: absent-not-valid, unknown-no-height, invalid `!` drawn + specimen, zero borrowed proofs, README proof verification honesty, `renderFigure` contract signs, unified stated/observed line convention) | `packages/atlas/src/{monge-model.ts,MongeFoldingSheet.svelte,bitemporal-model.ts,BitemporalStairSheet.svelte,flow-split-svg.ts,FlowSplitSheet.svelte,specimen.ts}`, `packages/reader-core/src/figure.ts`, `README.md` (proof claim only) | `[]` |
| `m4-zero-client-decision-boundary` | §2 (all 5 bullets) + §1 Kringstand retractions (`+1`/`-1` weights via `DeltaStore`) | `packages/reader-core/src/delta-store.ts`, `packages/atlas/src/KringstandSheet.svelte`, `packages/slip/bin/render.ts`, `packages/slip/src/{slip-props.ts,model.ts}` | `[]` |
| `m4-strict-guards-and-contrast` | §4 (all 6 bullets: real role-zero-leak, per-sign/state specimen coverage, drawn-layout geometry/xD tests, stricter `zero-compute-ast.mjs`, `pr-red-policy.mjs` green-test guard, WCAG AA `color-contrast` + OKLCH token bump) | `scripts/{zero-compute-ast.mjs,pr-red-policy.mjs,svelte-test-harness.mjs,contract-validators.mjs}`, `contracts/{std-view.v2.tokens.json,freeze-lock.json}` (planner bump), `packages/reader-core/src/palette.ts`, `tests/green/{role-zero-leak,geometry-invariants,xd-discipline-guard,zero-compute-ast,pr-red-policy}.test.mjs` | `['m3-std-view-matches-rezono']` |
| `m4-honest-claims-domain-and-i18n` | §5 (all 4 bullets) + §3 (real `ReaderClient` sheet wiring + `nightly-live.yml` Rezono checkout) | `package.json`, `package-lock.json`, `packages/atlas/src/{ripple-pixi.ts,StatutoryRelief3D.svelte,relief-model.ts,CausalRippleSheet.svelte,ripple-layout.ts}`, `packages/scene-ir/src/compilers.ts`, `scripts/leak-and-domain-check.mjs`, `.github/workflows/nightly-live.yml`, `docs/` / `README.md` (unbuilt claims) | `['m3-std-view-matches-rezono']` |

## Complete Bullet-to-Task Traceability (Issue #23 §1–§5)

### §1. Rezono's principles: unknown, absent, invalid and proof
1. **Absent painted as valid** (`monge-model.ts` / `MongeFoldingSheet.svelte`) -> `m4-epistemic-marks-and-proofs`.
2. **Unknown drawn with a height** (Sheet 05 `bitemporal-model.ts` / `BitemporalStairSheet.svelte` `z = 1` -> hatched band with no height/magnitude) -> `m4-epistemic-marks-and-proofs`.
3. **`invalid` (`!`) barely drawn** (`BitemporalStairSheet` + every sheet + `specimen.ts`) -> `m4-epistemic-marks-and-proofs`.
4. **Retractions show as rows** (Kringstand `+1`/`-1` weights via `DeltaStore`) -> `m4-zero-client-decision-boundary`.
5. **Borrowed proofs** (drift edge stated fallback, live round first-change ref, Monge round dots service ref -> own witness ref or explicit "no proof") -> `m4-epistemic-marks-and-proofs`.
6. **"Cryptographic proof per mark" unverified** (verify manifest/witness hashes via Rezono reader or drop claim from `README.md`) -> `m4-epistemic-marks-and-proofs`.
7. **Signs outside contract** (`renderFigure` `hatch`/`replaced` aligned with `std-view`) -> `m4-epistemic-marks-and-proofs`.
8. **Stated vs observed line convention** (unify solid vs dashed between Sheet 02 and Sheet 06) -> `m4-epistemic-marks-and-proofs`.

### §2. Cartouche deciding what Rezono decides (Decision 0001)
9. **Seal state** (`renderFromReader` must take `trustTier` and `canPropose` from reader head/seal/rights, never hard-code `sealed`) -> `m4-zero-client-decision-boundary`.
10. **Role projection** (remove client-side `role === 'summary'` stop selection) -> `m4-zero-client-decision-boundary`.
11. **Injected seals** (forbid caller-injected `seal` and `sealChecks`; seals come only from reader) -> `m4-zero-client-decision-boundary`.
12. **Self-sealing** (remove `DeltaStore.sealProvisionalAsRound`; only Rezono seals rounds) -> `m4-zero-client-decision-boundary`.
13. **Reader computations in browser** (audit ~10 computations in `packages/slip/src/model.ts`, move to Rezono gate/publisher or build-time compiler, and document disposition) -> `m4-zero-client-decision-boundary`.

### §3. Data source
14. **Hand-written fixtures / unused `ReaderClient`** (wire `ReaderClient` / real gate output into at least one sheet) -> `m4-honest-claims-domain-and-i18n`.
15. **Nightly live run never contacts Rezono** (`.github/workflows/nightly-live.yml` checks out pinned Rezono commit and regenerates fixture 10 transcript) -> `m4-honest-claims-domain-and-i18n`.
16. **Two Rezono pins (`bce08a52` and `f15c89d`)** -> covered by `m3-std-view-matches-rezono`.
17. **Out-of-sync contracts** -> covered by `m3-std-view-matches-rezono`.

### §4. Tests that check little
18. **Role leakage** (`role-zero-leak.test.mjs` renders complete-role data as restricted role and verifies zero leaks) -> `m4-strict-guards-and-contrast`.
19. **Specimens** (`verifySpecimenCoverage()` checks every sign and every state, not just counts) -> `m4-strict-guards-and-contrast`.
20. **Constants and grids** (xD and geometry tests assert drawn layout geometry, not compiler-set constants) -> `m4-strict-guards-and-contrast`.
21. **Zero-compute lint** (catch `z_norm`, `bar_units`, `dependent_count`, CSS `calc(...)`, and tighten `@cartouche-geometry-sort`) -> `m4-strict-guards-and-contrast`.
22. **Edited green tests** (`scripts/pr-red-policy.mjs` guards modifications to already-merged `tests/green/` files) -> `m4-strict-guards-and-contrast`.
23. **Contrast** (enable `axe-core` `color-contrast` and fix `inkFaint`, `hatch`, and obsidian `hatch` OKLCH tokens to pass WCAG 2.1 AA) -> `m4-strict-guards-and-contrast`.

### §5. Claims that are not built
24. **Unbuilt claims** (remove unused `three`/`@threlte/core` or build real 3D; align or remove unbuilt breathing/60fps/<250ms/radial-ring claims) -> `m4-honest-claims-domain-and-i18n`.
25. **Duplicate renderer palette** (`ripple-pixi.ts` consumes `PALETTES` from `@rezono/reader-core` instead of hard-coding a second palette) -> `m4-honest-claims-domain-and-i18n`.
26. **Domain words in domain-free packages** (rename `compileSubsidyReliefScene`, `income_cell`, `assets_cell` and catch CamelCase in `scripts/leak-and-domain-check.mjs`) -> `m4-honest-claims-domain-and-i18n`.
27. **Language** (replace hard-coded English sheet prose and raw `snake_case` reason codes with Rezono MF2 messages) -> `m4-honest-claims-domain-and-i18n`.

## Enforcement
- All four tasks are tracked as red tests under `tests/red/m4-*.test.mjs` citing this decision and verified by `scripts/decision-red-guard.mjs` and `npm run red-board`.
- Tasks touching frozen contracts (`m4-strict-guards-and-contrast` for OKLCH contrast tokens) or `package.json` (`m4-honest-claims-domain-and-i18n` for unused 3D deps) require planner/owner review per `decisions/0007-frozen-contracts-wave-0.md`.
