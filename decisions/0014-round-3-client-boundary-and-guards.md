---
id: 0014-round-3-client-boundary-and-guards
status: superseded
superseded_by: 0015-quality-round-3
milestone: M1
owner: core
created: 2026-11-21
---

# Decision 0014: Quality Review Round 3 — Client Boundary, Honesty & Guards (Issue #46)

> Superseded by Decision 0015 (`decisions/0015-quality-round-3.md`). It checks every point below with a behavioural test and replaces the remaining red test, `m1-monge-and-leftovers-honesty` (0015 §0).

## Context

Quality Review Round 3 (GitHub Issue #46, read at `3059d82`) found 18 concrete gaps where Issue #23 was closed prematurely: the interactive viewer computes seals and compiles sheets in the browser, `render.ts` still accepts `request.model` and fixture `seal_checks`, `canPropose` and `reader-hashes` are still derived or hard-coded client-side, Monge unknown curtains still have a fixed height (`CURTAIN_HEIGHT`), leftover domain/3D references remain, and several guards/tests (`zero-compute-ast.mjs`, `pr-red-policy.mjs`, `svelte-test-harness.mjs` SVG contrast, `specimen.ts`) still have blind spots.

Three items of Issue #46 are already handled or tracked elsewhere:
- **Item 9 (`invalid` `!` sign):** closed by `rezono-lang/rezono#1432` and Cartouche PR #49 (`m1-invalid-drawn-everywhere`).
- **Item 11 (real gate output):** tracked by `tests/red/m1-sheet-reads-gate-output.test.mjs` (upstream `rezono#1424`).
- **Item 13 (Rezono MF2 messages):** tracked by `tests/red/m2-messages-nl-en-no-raw-codes.test.mjs`.

## Decision

Every remaining finding in Issue #46 is captured first as a **real executable red test** (failing on `main` today, zero `assert.fail` to-do lists), partitioned into three non-overlapping M1 tasks:

| Task ID | Issue #46 Items | Primary File Ownership |
| --- | --- | --- |
| `m1-viewer-no-browser-seal` | Items 1–8 (viewer no browser `DeltaStore`/scene-compile/`seal`; `apps/` in `zero-compute-lint` & `leak-and-domain-check`; `render.ts` refuses `request.model` & fixture `seal_checks`; `canPropose` never computed client-side; `model.ts` no `source.kind` guessing or value-matched binding links; `slip-props.ts` no hard-coded `reader-hashes: green`; no fabricated `sweep:`/`rowProofRef` proof refs; `AGENTS.md:9` honest) | `apps/atlas-viewer/*`, `scripts/{zero-compute-lint,leak-and-domain-check}.mjs`, `packages/slip/{bin/render.ts,src/{model.ts,slip-props.ts}}`, `packages/reader-core/src/delta-store.ts`, `packages/atlas/src/KringstandSheet.svelte`, `AGENTS.md` |
| `m1-monge-and-leftovers-honesty` | Items 10, 12, 18 (Monge unknown curtain has no fixed `CURTAIN_HEIGHT`, `changed`/`not_applicable` never paint valid-green; `nightly-live.yml` dead `REZONO_LIVE_DIR` & wrong step name fixed; leftovers removed: `relief-model.ts` `threlteScene`, `docs/AGENT-LAUNCH-KIT.md` removed deps, `StatutoryRelief3D` domain word, `model.ts` `law`/`statute`/`policy`) | `packages/atlas/src/{monge-model.ts,MongeFoldingSheet.svelte,relief-model.ts}`, `.github/workflows/nightly-live.yml`, `docs/AGENT-LAUNCH-KIT.md`, `packages/slip/src/model.ts` |
| `m1-guards-and-svg-contrast` | Items 14, 15, 16, 17 (`zero-compute-ast.mjs` catches `dependentTotal` threshold, `calc(var(--z)...)`, `@cartouche-geometry-sort` on `hop`; `pr-red-policy.mjs` protects `svelte-test-harness.mjs`, `leak-and-domain-check.mjs`, `package.json`; `auditA11y` decides SVG `fill` contrast + opacity + `@` blocks; `specimen.ts` checks real rendered signs/palettes; real `role-zero-leak` & sweep-stops tests) | `scripts/{zero-compute-ast.mjs,pr-red-policy.mjs,svelte-test-harness.mjs}`, `packages/atlas/src/specimen.ts`, `tests/green/{role-zero-leak,m2-slip-sweep-stops-and-fold,specimen-coverage}.test.mjs` |

## Rules
- On promotion (`tests/red/<id>.test.mjs` -> `tests/green/<id>.test.mjs`), workers MUST preserve every assertion verbatim (per Decision 0012 §9).
- No existing green test may be weakened.
