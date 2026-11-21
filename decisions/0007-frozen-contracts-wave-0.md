---
id: 0007-frozen-contracts-wave-0
status: accepted
milestone: M0
owner: core
created: 2026-11-21
---

# Decision 0007: Freeze Four Core Contracts Before Worker Wave 1

## Context
Parallel autonomous workers building the six Atlas sheets and `@rezono/slip` must share immutable interfaces so concurrent PRs never collide over IR fields, DOM selectors, server payload shapes, or color/sign tokens.

## Decision
Before launching Wave 1 (`M1`), Cartouche freezes four compact contracts under `contracts/` and pins their LF-normalized SHA-256 hashes in `contracts/freeze-lock.json`:

1. **`contracts/cartouche-scene.v2.schema.json`** — `CartoucheScene` v2 IR schema plus the seven machine-enforced `xD-Discipline Guard` laws (`XD_*`) and eight headless geometric/epistemic invariants (`GEOM_*`, `MONGE_*`, `EPI_*`).
2. **`contracts/data-marks.json`** — Canonical DOM and SVG `data-*` test anchors covering all seven transferred `@rezono/slip` conformance contracts and all six Atlas sheets, exported as typed constants in `@rezono/reader-core`.
3. **`contracts/server-projections.schema.json`** — Full schema for the five minimal server projections (`layer_tag` + `absent.sweep_witness`, `cut_set`, `sweep_2d`, `bitemporal_grid`, `slip_enrichment`) plus `unserved` 410, `kring` Z-set deltas, and `monge` 4D audit payloads, verified against all eight golden fixtures in `fixtures/01..08.json`.
4. **`contracts/std-view.v2.tokens.json`** — Perceptual `OKLCH` palettes (`swisstopo`, `obsidian`, `forced`), CSS custom property mappings, WCAG 2.1 AA lightness-separation bounds, non-color sign glyphs/patterns, and the six-verb `std-view` bar (`w d m s c p`).

## Enforcement
- `scripts/contract-freeze-guard.mjs` runs inside `npm run fast-check` and CI on every PR.
- Worker PRs MUST NOT mutate any frozen contract or `contracts/freeze-lock.json`. Updating a frozen contract requires a planner decision bump and explicit lock regeneration.
- Every TypeScript package export (`PALETTES`, `SIGNS`, `STD_VERBS`, `DATA_MARKS`, `XD_LAW_CODES`, `GEOM_INVARIANT_CODES`, `SPECIMEN_ENTRIES`) is verified for zero drift against the frozen JSON files.
