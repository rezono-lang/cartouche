---
id: 0005-rezono-core-five-projections
status: accepted
milestone: M2
owner: core
created: 2026-11-21
---

# Decision 0005: Five Minimal Server Projections from Rezono Core

## Context
To uphold Zero Client Compute across all six Atlas sheets without waiting for live backend infrastructure during UI development, Cartouche defines five small, domain-neutral projection contracts and freezes eight golden JSON fixtures in `fixtures/`.

## Decision
Rezono core publications expose five optional projection extensions (documented in `contracts/server-projections.schema.json`):
1. `layer_tag` (`stated | observed | both`) + `absent.sweep_witness` (feeds Sheet 02 and Sheet 06).
2. `cut_set` (`load_bearing`, `redundancy_margin`, `gate: AND | OR`) (feeds Sheet 04).
3. `sweep_2d` (pre-projected `N×M` opaque cells + `cliff_distances` + `unknown_manifold`) (feeds Sheet 01).
4. `bitemporal_grid` (2D opaque matrix across `valid_times × epochs`, explicit `not_applicable` when `valid > knowledge`) (feeds Sheet 05).
5. `slip_enrichment` (`prism_5`, `missing_levers`, `adjacent_worlds_delta1`) (feeds `@rezono/slip` across all sheets).

All PR CI runs test against frozen golden fixtures in `fixtures/`; cross-repo live parity runs nightly via `.github/workflows/nightly-live.yml`.
