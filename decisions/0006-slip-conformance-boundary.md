---
id: 0006-slip-conformance-boundary
status: accepted
milestone: M1
owner: slip
created: 2026-11-21
---

# Decision 0006: Clean Repository Boundary & Transferred Slip Conformance Suite

## Context
Building a standalone Svelte `viewer/slip` application inside `rezono-lang/rezono` alongside `rezono-lang/cartouche` would duplicate UI stacks, lockfiles, Dependabot churn, and cross-repository release coupling. Rezono already ships headless reference readers (`tools/repl/`, `tools/mcp/`, and CLI `rezono show`).

## Decision
1. **Strict Repository Split:**
   - **`rezono-lang/rezono`** owns contracts, `packs/std-view`, role-scoped `edge/gate` bundles (with type fields), `head` status/hash, sweeps, `rezono.turns/1`, shared non-UI message/canonical helpers (`canon.ts`, `fill.ts`), headless readers (REPL, MCP, CLI), and the pure backend/contract tests.
   - **`rezono-lang/cartouche`** owns **all** browser and Svelte presentation code — including `@rezono/reader-core`, `@rezono/scene-ir`, `@rezono/slip`, and `@rezono/cartouche-atlas` — and becomes the canonical home of the seven Slip DOM conformance requirements originally specified in Rezono's `viewer-slip` design.
2. **Transferred Seven-Part Slip Conformance Contract:**
   Every release of `@rezono/slip` MUST satisfy all seven conformance requirements using only canonical `data-*` marks from `contracts/data-marks.json`:
   - `slip-rule-row`: opens on the single readable row of the role's home claim; renders `[data-part=sentence]` with `a[data-line]` links bound to premise positions; lists `grounds` distance-1 lines in exact reader order with `data-relation`, `data-key`, `data-polarity`, `data-depth`; nests aggregate contributors (`data-depth="1"`) immediately after their published `tr[data-line][data-part=total]`.
   - `slip-calculated-row`: renders `CalcWitness` steps in published order with `data-path` and `data-depth`; omits constants (no `tr[data-path]` for constant arguments).
   - `unknown-shows-no-digit`: non-`known` cells carry `td[data-part=value][data-state][data-reason]` plus a `[data-sign]` element from `std-view`, and contain zero ASCII digits (`/[0-9]/`).
   - `verbs-that-answer`: renders `button[data-verb][data-key]` in `std-view` `Sheets.verbs` order strictly for verbs whose question the reader answers for that line; opening a verb renders `table[data-answer="<question>"]` with `th` headers; adding a question to the reader surfaces its verb with **identical built page hashes (`files`)** and zero page code changes.
   - `tables-and-legend`: `table[data-sheet=slip]` and every `table[data-answer]` have `th` header rows; every `[data-sign]` drawn anywhere on the page appears as a `tr[data-sign]` row in `table[data-part=legend]`.
   - `unserved-publication`: served publications display `[data-part=seal]` with `[data-check="reader-hashes"]`, `[data-check="publisher-record"]`, and `[data-part="manifest-hash"]`; when the reader refuses a tampered or withdrawn publication, the page renders `[data-part=unserved]` and zero `tr[data-line]` rows.
   - `stops-only` (Step 2 / M2): `[S]` (`suppose`) opens an inline sweep control with one `[data-stop][data-status][data-turn]` per published grid stop; `red` stops list `[data-check][data-status="red"]` with no value; `red` and `not_computed` stops produce no `<ins>` fold; valid stops render `<del>` (old) and `<ins>` (new) solely from the published variant difference; partial-read roles see every stop as `unavailable`.
3. **Deterministic Render Harness:**
   `@rezono/slip` exposes a deterministic `render` entry accepting a JSON request (`{ store | fixture, role, pack, lang, row?, keys?, reader? }`) and returning `{ html, files }` (SHA-256 of every built asset) so both local fixture conformance and nightly live Rezono-store parity use the exact same contract.
