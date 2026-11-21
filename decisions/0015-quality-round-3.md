---
id: 0015-quality-round-3
status: accepted
milestone: M1
owner: planner
created: 2026-11-21
---

# Decision 0015: Quality Round 3 — #23 Was Not Done, and a Planner Writes the Assertion

## Context

- Issue #23 listed 27 findings. It was closed on 21-11 at 09:10 with the claim that all 27 were fixed.
- Quality review round 3 (issue #46, read at `3059d82`) found otherwise:
  - 11 findings are fixed;
  - 13 are partly fixed;
  - 3 are not fixed.
- So #23 was closed while 16 of its 27 points were still open. #46 carries them.
- How it happened: Decision 0011's four M4 tests were `assert.fail` to-do lists. Each green test was then written in the same PR as its fix, so nobody but the fixing worker decided what "fixed" meant.
- Round 3 also found new principle violations. The worst is N1: the viewer (#36) seals in the browser and unlocks Propose.

## Decision

### 0. Relation to Decision 0014

Decision 0014 (PR #52) landed while this plan was being written. It partitioned #46 into three bundled M1 tests: `m1-viewer-no-browser-seal` (points 1 to 8), `m1-monge-and-leftovers-honesty` and `m1-guards-and-svg-contrast`.

This decision supersedes that partition, for two reasons.

- **The tests match source text.** Most of their assertions test the shape of the code with a regular expression, for example "`zero-compute-lint.mjs` contains the string `'apps'`" or "`model.ts` has no `originSignForSourceKind`". A worker can satisfy such an assertion without fixing anything. This is the weakness #46 found in #23's to-do lists.
- **The fixes are blocked.** Green assertions that hold the findings (§5) were left in place, so a worker could not fix the findings without editing a green test.

Its three red tests are replaced by the tasks of §4. `m1-viewer-no-browser-seal` keeps its name, with new content. Each of its assertions has a behavioural replacement:

| 0014 assertion | Replaced by |
| --- | --- |
| App.svelte has no `DeltaStore`, no scene compiler, no `seal=` on Slip | `m1-viewer-no-browser-seal`, `m1-viewer-prerendered-and-guarded` (the Vite build graph, and the Svelte AST) |
| The lint and the domain check name `apps` | `m1-viewer-prerendered-and-guarded` (the guards run on a temp tree with a violation under `apps/`) |
| render() refuses `model` and fixture `seal_checks` | `m1-slip-refuses-request-model`, `m1-no-injected-seal-checks` |
| No `reader-hashes: green`, `rowProofRef`, `sweep:` refs or `provisionalCount` in source | `m1-seal-checks-only-as-served`, `m1-proof-refs-only-as-served`, `m1-reads-only-served-head-fields` |
| No `originSignForSourceKind` or value-matched bindings in `model.ts` | `m1-origin-signs-and-bindings-from-reader` (a kind mutation and a binding mutation) |
| `canPropose` not derived client-side | `m1-propose-locked-until-served` |
| `AGENTS.md` makes no verifiable-witness claim | `m1-proof-refs-only-as-served` |
| No `CURTAIN_HEIGHT`; `changed` and `not_applicable` not painted valid | `m1-monge-unknown-and-state-colours` (curtain height against the round axis, and drawn fills) |
| `nightly-live.yml` has no `REZONO_LIVE_DIR` and no false fixture-10 step | `m2-nightly-step-says-what-it-does` (the parsed workflow) |
| No `threlteScene`, no Threlte in the docs, no `statutory`, no law/statute/policy | `m2-leftovers-removed`, `m1-origin-signs-and-bindings-from-reader` |
| The lint catches the three escapes | `m1-zero-compute-lint-fails-closed` (the escapes as frozen snippets, plus a renamed field) |
| The PR guard protects the harness, the domain check and `package.json` | `m1-green-guard-covers-harness` |
| auditA11y decides SVG fill and opacity | `m1-contrast-reads-svg-fill` |
| The specimen counts no palettes; the role-leak and sweep tests don't feed their own inputs | `m2-sheets-tested-as-drawn`, `m2-role-leak-on-reader-output`; the sweep test is fixed in this PR |

### 1. #46 is the open list
Every open point of #46 is a red test on the board, or is covered by one that is already there.
- Point 9: since #49, `m1-invalid-drawn-everywhere` is green, so this point is done.
- Point 11: covered by `m1-sheet-reads-gate-output`. That task is already claimed, so this PR leaves it alone.
- Point 13: covered by `m2-messages-nl-en-no-raw-codes`.

### 2. The new findings, N1 to N7

| # | Finding | #46 point |
| --- | --- | --- |
| N1 | The viewer builds a seal with `DeltaStore` in the browser, which unlocks Propose, and passes it to `Slip.svelte` | 1 |
| N2 | The sheets are compiled and laid out in the browser from hand-written fixtures; `apps/` is outside the zero-compute lint and the domain check | 2 |
| N3 | `render()` accepts a caller-built `request.model`, and the page trusts its `proposeAllowed` | 3 |
| N4 | Cartouche maps a source's `kind` text to an origin sign, and links a binding to a premise by matching its value | 5 |
| N5 | `reader-hashes: green` is hard-coded in `slip-props.ts` | 6 |
| N6 | The contrast checker skips SVG `fill`, drops every `@` block and ignores opacity | 17 |
| N7 | `render.ts` reads `trust_tier`, `can_propose`, `rights`, `seal` and `provisional_count` from `/slip/head`, none of which Rezono serves | 4 |

Besides these, `canPropose` is computed in Cartouche: in `delta-store.ts`, in `render.ts` and in `KringstandSheet.svelte` (point 4).

### 3. A planner writes the executable assertion

This rule follows Decision 0013 §13 and now applies to every red test, in M1 to M3. It supersedes Decision 0012 §9, which let the promoting worker write the assertions.

- **Acceptance lists are not claimable.**
  - A red test that holds an `assert.fail` acceptance list cannot be claimed.
  - A planner PR first records its input: Rezono's output, or a devDependency.
  - The same PR turns each numbered point into an executable assertion with hand-checked expectations, which fails on `main` for the reason its message names.
  - The worker then makes that assertion pass and does not edit it.
- **Executable tests test behaviour.** They render pages, read the build graph, run the guards or walk the AST. They never match source text with a regex.
- **The board shows the gates.** A `waits_on` entry that is not a red-test id is an external gate:
  - `rezono-lang/rezono#N`: a Rezono issue;
  - `devDependency:<name>`: a tool only a planner adds;
  - `planner:assertions`: the planner PR above.

  `npm run red-board` counts a gate as open until a planner PR removes it.
- **Existing tasks.** This PR adds `planner:assertions` to every open acceptance-list task of Decisions 0012 and 0013.
  - Exception: `m1-sheet-reads-gate-output`. It is already claimed and finishes under 0012 §9.
  - Its PR gets a planner review of its assertions before it merges.

### 4. Tasks

Decision 0012 §1 holds: every M2 and M3 task waits on every open M1 task, including the new ones.

**M1, priority 1: principle violations**

| Red test | Covers | Kind |
| --- | --- | --- |
| `m1-viewer-no-browser-seal` | N1, point 1 | executable |
| `m1-viewer-prerendered-and-guarded` | N2, point 2 (waits on N1: same file) | executable |
| `m1-slip-refuses-request-model` | N3, point 3 | executable |
| `m1-propose-locked-until-served` | `canPropose` computed in Cartouche, point 4 | executable |
| `m1-origin-signs-and-bindings-from-reader` | N4, point 5; also the law, statute and policy words of point 18 | executable |
| `m1-seal-checks-only-as-served` | N5, point 6 | executable |

**M1, priority 2**

| Red test | Covers | Kind |
| --- | --- | --- |
| `m1-no-injected-seal-checks` | point 7, a fixture's `seal_checks` (waits on N3) | executable |
| `m1-proof-refs-only-as-served` | point 8 | executable |
| `m1-monge-unknown-and-state-colours` | point 10 | executable |
| `m1-zero-compute-lint-fails-closed` | point 16 | executable |
| `m1-green-guard-covers-harness` | point 17, the guard | executable |
| `m1-contrast-reads-svg-fill` | N6, point 17 | executable |
| `m1-reads-only-served-head-fields` | N7, point 4 (waits on the `canPropose` task: same code) | executable |

**M2, priority 3: after the proof map**

| Red test | Covers | Kind |
| --- | --- | --- |
| `m2-seal-and-rights-from-rezono` | points 4 to 7 once Rezono serves the fields, including `ingestSealedSnapshot` (point 7) | acceptance; waits on `rezono-lang/rezono#1451` and a planner |
| `m2-nightly-step-says-what-it-does` | point 12 | executable |
| `m2-role-leak-on-reader-output` | point 14, the role leak test | acceptance; waits on a planner |
| `m2-sheets-tested-as-drawn` | point 15 | acceptance; waits on `devDependency:playwright` and a planner |
| `m2-leftovers-removed` | point 18 | executable |

The other half of point 14 is fixed in this PR. `m2-slip-sweep-stops-and-fold` now reads the summary role's stops from fixture 10's recorded answers. Before, it fed in the stops it then checked.

### 5. Green assertions that encoded a finding

Some green assertions held exactly what #46 calls wrong. A worker can't fix such a finding without editing a green test, and only a planner may edit one. So this PR moves each of these assertions into the red test that reverses it. No assertion is dropped without its reversal.

- **`canPropose === true` from `DeltaStore`, the scene compilers or Kringstand** moves to `m1-propose-locked-until-served`. It was asserted in:
  - `delta-store-seal`;
  - `m4-zero-client-decision-boundary`;
  - `m1-scene-compilers-remaining`;
  - `m1-sheet-kringstand-live` (Propose and Approve unlocked when sealed).
- **`m1-slip-svelte-component`** now passes the reader's grant as an explicit input (`canPropose: true` on the seal it gives the component), instead of relying on `DeltaStore`.
- **"A guessed `trust_tier` on `/slip/head` changes or refuses the seal"** (`m4-zero-client-decision-boundary`) moves to `m1-reads-only-served-head-fields`.
- **`m1-slip-proof-tree`:**
  - "every leaf carries an origin sign" moves to `m1-origin-signs-and-bindings-from-reader`;
  - "`reader-hashes` is green" moves to `m1-seal-checks-only-as-served`.

### 6. Rezono

[rezono-lang/rezono#1451](https://github.com/rezono-lang/rezono/issues/1451) asks Rezono's reader to serve four things:
1. the trust tier;
2. the role's right to propose;
3. the reader's hash check per witness;
4. the origin sign per source.

Until Rezono serves them:
- Propose stays locked and says `propose_locked_not_served`;
- `reader-hashes` reads `unavailable`;
- no origin sign is drawn;
- no undefined field is read.

`m2-seal-and-rights-from-rezono` is the positive direction, once Rezono serves the fields.

### 7. Names this decision sets
- **`propose_locked_not_served`:** the reason code when the reader serves no right to propose. The slip uses it as `data-reason`, Kringstand as `data-lock-reason`.
- **`data-status="unavailable"`:** marks a seal check the reader does not serve. This is an existing contract value, so no contract bump is needed.
- **The Monge unknown curtain** spans the whole round axis, from the floor to the wall top. It is a vertical curtain (Decision 0002 §2) with no height of its own (Decision 0012 6b).
- **The zero-compute lint fails closed:** a value the lint can't show to be geometry counts as data. The zero-false-positive cases of `tests/green/zero-compute-ast.test.mjs` stay allowed.
- **Guarded paths:** besides the existing ones, these need the `planner` label:
  - the test harness and `tests/support/`;
  - the domain check;
  - `scripts/fast-check.mjs`;
  - `package.json` and `package-lock.json`.

### 8. Not tested, with reason
- **The `planner` label is set by the PR author's own account** (#46 point 17). The diff doesn't show who set a label, and every PR so far comes from one account. A rule that needs a second account or a required review is the owner's call, so it is left open here.
- **`model.ts` lists its reader computations** (#46 point 5). That is documentation; `m1-origin-signs-and-bindings-from-reader` tests the behaviour.

## Consequences
- **Board:** 13 new M1 tasks (6 of them priority 1) and 5 new M2 tasks. 15 are executable and 3 are acceptance lists.
- **Gate:** M2 and M3 now also wait on the 13 new M1 tasks.
- **No acceptance task is claimable** until a planner has written its assertions.
