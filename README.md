# Cartouche

**Proof-carrying cartography and x-dimensional visual exploration for [Rezono](https://github.com/rezono-lang/rezono).**

Cartouche renders verifiable Rezono publications in one serene visual language — **Swisstopo Matte Archival Relief** (plus perceptual `OKLCH` **Obsidian Night** and **Forced Colors**) — with **zero client-side computation** and **verifiable witness references per mark** checked against Rezono's manifest and reader.

## Architecture (Four Strict Layers)

1. **`packages/reader-core` (`@rezono/reader-core`):** 0-dependency pure TypeScript — opaque `DisplayCell` guards, Z-set `DeltaStore` (`sealed` + `provisional`), deterministic ICU-free `Figure` formatter, `std-view` v2 `OKLCH` palettes, canonical JSON, and `ReaderClient` SHA-256 verification.
2. **`packages/scene-ir` (`@rezono/scene-ir`):** Deterministic `CartoucheScene` v2 Intermediate Representation, the built-in **`xD-Discipline Guard`**, headless **geometric invariant checker**, pure zero-compute sheet compilers, and deterministic Typst source export.
3. **`packages/slip` (`@rezono/slip`):** Embeddable proof drawer — 5-bar micro **Epistemic Prism**, 6 keyboard-bound verbs (`W D M S C P`), `[M]` **Certainty Levers**, `[S]` **`Δ = 1` Adjacent Worlds**, and automatic `[P] Propose` lock on unsealed provisional streams.
4. **`packages/atlas` (`@rezono/cartouche-atlas`):** The six deterministic Sheet Archetypes (pure orthographic/axonometric SVG + PixiJS v8 distance columns + synchronized accessible HTML table twins) + automated `_specimen` visual oracle:
   - `01` **Orthographic Relief** (`X × Y → Z` orthographic SVG terrain + hatched `unknown` uncertainty curtain + 2D profile)
   - `02` **Flow & Reality-Split Curtain** (`stated ◆ ∥ observed ●` revealing `drift ══`, `absent ⦸`, `unknown ▨`)
   - `03` **Kringstand & Live Feed** (round chronometer, `absent ⦸` vs `unknown ▨`, provisional stream `[P]` lock)
   - `04` **Causal Ripple & Load-Bearing Cut-Sets** (adaptive distance columns rendered via SVG + PixiJS v8, `OR`-shields vs `AND` cliffs)
   - `05` **Bitemporal Staircase** (`Valid Time × Knowledge Time`, 2D matrix ↔ orthographic SVG staircase + hollow `– N/A`)
   - `06` **Monge Orthographic Folding Atlas** (`0° flat 2D ↔ 90° orthographic SVG prism`, 4D with zero perspective distortion)

## Quickstart (Node 22+, Zero Install Required for Day-0 Gates)

```bash
# Run the complete <5s Day-0 fast check (lints, guards, fixtures, unit & geometric tests)
npm run fast-check

# Inspect the red-test task board for agents
npm run red-board
npm run red-board -- --json
```

## Decisions & Roadmap

All architectural contracts live in `decisions/` with structured heads, and all frozen Rezono contract fixtures live in `fixtures/`. See `docs/AGENT-LAUNCH-KIT.md` for running parallel planner/worker/reviewer agents with WIP backpressure.
