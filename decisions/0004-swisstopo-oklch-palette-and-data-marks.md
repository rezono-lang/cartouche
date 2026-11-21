---
id: 0004-swisstopo-oklch-palette-and-data-marks
status: accepted
milestone: M0
owner: core
created: 2026-11-21
---

# Decision 0004: Swisstopo Archival OKLCH Palette and Canonical DOM data-* Marks

## Context
Visual styling and test contracts must be decoupled from hardcoded domain themes and fragile CSS selectors.

## Decision
1. Cartouche adopts **Swisstopo Matte Archival Relief** (`#faf8f3` warm archival paper, `#1c1b19` ink, matte Swiss Proof Cobalt `#0b4fb3`, warm limestone contours) as the default palette across both policy and platform sheets.
2. All three built-in palettes (`swisstopo`, `obsidian`, `forced`) are generated deterministically from perceptual `OKLCH` tokens in `packages/reader-core/src/palette.ts`.
3. Every interactive and epistemic element emits canonical `data-*` attributes specified in `contracts/data-marks.json` (`data-sheet`, `data-sign`, `data-state`, `data-reason`, `data-verb`, `data-part`, `data-trust-tier`) so Playwright and DOM tests never couple to class names or prose.
