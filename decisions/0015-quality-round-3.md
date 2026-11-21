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

While this plan was in review, three PRs landed:
- **#52 (Decision 0014)** split #46 into three bundled M1 tests.
- **#53** promoted one of them, `m1-guards-and-svg-contrast`.
- **#55** promoted another, `m1-viewer-no-browser-seal`.

This decision was checked against `main` after #55 (`586cd9d`).

## Decision

### 0. Relation to Decision 0014

Decision 0014 is superseded. Its tests mostly match source text with a regular expression, for example "`zero-compute-lint.mjs` contains the string `'apps'`" or "`model.ts` has no `originSignForSourceKind`". A worker can satisfy such an assertion without fixing anything; this is the weakness #46 found in #23's to-do lists.

What happens to each of its three tests:
- **`m1-viewer-no-browser-seal` and `m1-guards-and-svg-contrast`** are green (#55, #53). They stay. Every point they cover is checked again by a behavioural test below, which arrives green or stays red.
- **`m1-monge-and-leftovers-honesty`** is still red. It is replaced by `m1-monge-unknown-and-state-colours`, `m2-nightly-step-says-what-it-does` and `m2-leftovers-removed`.

Each assertion of 0014 maps to a behavioural check:

| 0014 assertion | Behavioural check |
| --- | --- |
| App.svelte has no `DeltaStore`, no scene compiler, no `seal=` on Slip | green `m1-viewer-slip-built-from-reader` (the page and the Svelte AST); red `m1-viewer-prerendered-and-guarded` (the Vite build graph) |
| The lint and the domain check name `apps` | `m1-viewer-prerendered-and-guarded`: the guards run on a temp tree with a violation under `apps/` (passes since #55) |
| render() refuses `model` and fixture `seal_checks` | green `m1-slip-refuses-request-model`, `m1-no-injected-seal-checks` |
| No `reader-hashes: green`, `rowProofRef`, `sweep:` refs or `provisionalCount` | green `m1-seal-checks-only-as-served`; red `m1-proof-refs-only-as-served`, `m1-reads-only-served-head-fields` |
| No `originSignForSourceKind`, no value-matched bindings | green `m1-origin-signs-and-bindings-from-reader` (a kind mutation and a binding mutation) |
| `canPropose` not derived client-side | red `m1-propose-locked-until-served` |
| `AGENTS.md` makes no verifiable-witness claim | `m1-proof-refs-only-as-served` (passes since #55) |
| No `CURTAIN_HEIGHT`; `changed` and `not_applicable` not painted valid | red `m1-monge-unknown-and-state-colours` (curtain height against the round axis, and drawn fills) |
| `nightly-live.yml` has no `REZONO_LIVE_DIR` and no false fixture-10 step | red `m2-nightly-step-says-what-it-does` (the parsed workflow) |
| No `threlteScene`, no Threlte in the docs, no `statutory` | red `m2-leftovers-removed` |
| The lint catches the three escapes | red `m1-zero-compute-lint-fails-closed` (frozen snippets plus a renamed field; two of four pass since #53) |
| The PR guard protects the harness, the domain check and `package.json` | red `m1-green-guard-covers-harness` (adds the lockfile, `fast-check.mjs` and `tests/support/`) |
| auditA11y decides SVG fill, opacity and `@` blocks | green `m1-contrast-reads-svg-fill` |
| The specimen counts no palettes; the role-leak and sweep tests don't feed their own inputs | red `m2-sheets-tested-as-drawn`, `m2-role-leak-on-reader-output`; the sweep test was fixed by #53 |

### 1. #46 is the open list
Every open point of #46 is a red test on the board, or is covered by one that is already there.
- Point 9: since #49, `m1-invalid-drawn-everywhere` is green, so this point is done.
- Point 11: covered by `m1-sheet-reads-gate-output`. That task is already claimed, so this PR leaves it alone.
- Point 13: covered by `m2-messages-nl-en-no-raw-codes`.

### 2. The new findings, N1 to N7

| # | Finding | #46 point | State at `586cd9d` |
| --- | --- | --- | --- |
| N1 | The viewer builds a seal with `DeltaStore` in the browser, which unlocks Propose, and passes it to `Slip.svelte` | 1 | slip fixed by #55; `DeltaStore` still ships in the bundle (N2) |
| N2 | The sheets are compiled and laid out in the browser; `apps/` is outside the zero-compute lint and the domain check | 2 | guards fixed by #55; the sheets are still compiled in the browser |
| N3 | `render()` accepts a caller-built `request.model` | 3 | fixed by #55 |
| N4 | Cartouche maps a source's `kind` text to an origin sign, and links a binding by matching its value | 5 | fixed by #55 |
| N5 | `reader-hashes: green` is hard-coded in `slip-props.ts` | 6 | fixed by #55 |
| N6 | The contrast checker skips SVG `fill`, drops every `@` block and ignores opacity | 17 | fixed by #53 |
| N7 | `render.ts` reads `trust_tier`, `can_propose`, `rights`, `seal` and `provisional_count` from `/slip/head`, none of which Rezono serves | 4 | open |

Besides these, `canPropose` is computed in Cartouche (point 4). At `586cd9d` it is locked unless a guessed grant field is present, and two slip paths say nothing about why it is locked. The enrichment path even says `propose_locked_witness_failed` while the witness check is green.

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

**Green on arrival.** These are behavioural checks of what #53 and #55 fixed while this plan was in review:
- `m1-viewer-slip-built-from-reader` (N1)
- `m1-slip-refuses-request-model` (N3)
- `m1-origin-signs-and-bindings-from-reader` (N4)
- `m1-seal-checks-only-as-served` (N5)
- `m1-contrast-reads-svg-fill` (N6)
- `m1-no-injected-seal-checks` (point 7)

**M1, priority 1: principle violations**

| Red test | Covers | Kind |
| --- | --- | --- |
| `m1-viewer-prerendered-and-guarded` | N2, point 2 | executable |
| `m1-propose-locked-until-served` | `canPropose` computed in Cartouche, point 4 | executable |

**M1, priority 2**

| Red test | Covers | Kind |
| --- | --- | --- |
| `m1-proof-refs-only-as-served` | point 8: the slip subject borrows the manifest id | executable |
| `m1-monge-unknown-and-state-colours` | point 10 | executable |
| `m1-zero-compute-lint-fails-closed` | point 16 | executable |
| `m1-green-guard-covers-harness` | point 17, the guard | executable |
| `m1-reads-only-served-head-fields` | N7, point 4 (waits on the `canPropose` task: same code) | executable |

**M2, priority 3: after the proof map**

| Red test | Covers | Kind |
| --- | --- | --- |
| `m2-seal-and-rights-from-rezono` | points 4 to 7 once Rezono serves the fields, including `ingestSealedSnapshot` (point 7) | acceptance; waits on `rezono-lang/rezono#1451` and a planner |
| `m2-nightly-step-says-what-it-does` | point 12 | executable |
| `m2-role-leak-on-reader-output` | point 14, the role leak test | acceptance; waits on a planner |
| `m2-sheets-tested-as-drawn` | point 15 | acceptance; waits on `devDependency:playwright` and a planner |
| `m2-leftovers-removed` | point 18 | executable |

### 5. Green assertions that encoded a finding

One green assertion still holds a #46 finding. `m4-zero-client-decision-boundary` asserts that a guessed `trust_tier` on `/slip/head` changes the seal, or is refused. This PR moves it, reversed, to `m1-reads-only-served-head-fields`.

#55 had already adjusted the other green tests that encoded findings.

### 6. Rezono

[rezono-lang/rezono#1451](https://github.com/rezono-lang/rezono/issues/1451) asks Rezono's reader to serve four things:
1. the trust tier;
2. the role's right to propose;
3. the reader's hash check per witness;
4. the origin sign per source.

Until Rezono serves them:
- Propose stays locked and says why;
- `reader-hashes` is not shown, or reads `unavailable`;
- no origin sign is drawn;
- no undefined field is read.

`m2-seal-and-rights-from-rezono` is the positive direction, once Rezono serves the fields.

### 7. Names this decision sets
- **`propose_locked_no_reader_grant`** (the code #55 introduced): every page that locks Propose because the reader served no right says so in `data-reason`. Kringstand says it in `data-lock-reason`.
- **A seal check the reader does not serve** is not shown, or is shown with `data-status="unavailable"`, an existing contract value.
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
- **Board:** 7 new M1 tasks (2 of them priority 1) and 5 new M2 tasks. 9 are executable and 3 are acceptance lists.
- **Green checks:** 6 behavioural checks arrive green.
- **Removed:** Decision 0014's last red test is removed.
- **Gate:** M2 and M3 now also wait on the 7 new M1 tasks.
- **No acceptance task is claimable** until a planner has written its assertions.
