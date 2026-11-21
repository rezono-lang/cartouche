---
id: 0012-proof-first-plan
status: accepted
milestone: M1
owner: planner
created: 2026-11-21
decided_by: owner
---

# Decision 0012: Proof First — Re-order the Plan Around the Slip and Rezono's Gate

## Context

Cartouche was started on 21-11 and most of its board turned green overnight. The quality review of that day
(issue #23) found principle violations, hand-written fixtures everywhere, weak tests and claims that were never built.
Decision 0011 turned the findings into four M4 tasks, and #30 to #33 promoted all four.

The owner's judgement on 21-11 keeps the visual grammar:

- zero client compute and opaque cells (Decision 0001);
- a table twin and a seal per sheet;
- the key of signs: ▨ unknown, ⦸ absent, ◇ supposed, ! invalid;
- the calm swisstopo palette;
- the slip as the proof drawer;
- the bitemporal staircase and the split between stated and observed flow.

But the order was wrong. Ambition (Monge folding, 3D relief, PDF) came before the basics:

- no sheet opens the slip from a mark;
- every sheet reads a hand-written fixture instead of Rezono's gate;
- there is no app or entry page;
- several visuals carry no data meaning.

Cartouche learns from RDFox (three-pane Explain: proof tree, proof graph, rule with bindings) and from Stardog
(Designer's question scoring, Explorer pages and share links, Voicebox answer provenance, Knowledge Kits, visual
query plans). It does better where only Rezono can: why unknown, why not, time, roles and a verified proof.

## Decision

### 1. Order

The plan has three milestones. **No M2 or M3 task and no new sheet work starts until M1 is green.** Every M2 and M3
red test lists every open M1 test in `waits_on`, so `npm run red-board` shows them as waiting until the last M1 test is
promoted.

### 2. M1, proof first

Each principle fix of issue #23 §1 is its own test. The tests of 6a to 6g and 7a, 7b and 5b are executable: they were
written against `8b3c96d` (before #30 to #33), failed there for the reason they name, and were run again on the main
that #30 to #33 left. Four now pass. They go straight to `tests/green/` as independent checks of the M4 fixes. The
other executable tests still fail, which shows what the M4 work left open.

| # | Test | What is accepted | State on arrival |
| --- | --- | --- | --- |
| 1 | `m1-mark-opens-slip` | Every mark on every sheet is a link to the slip, opened on that conclusion's address: Rezono's conclusion IRI pinned to epoch and dataset hash (`<kind iri>/<spelled id>?pin=m-<epoch>@d-<64 hex>`, Rezono `decisions/publication-conclusion-addresses.md`). Every mark has a target, and the target resolves in the slip to exactly that row. A pin that does not match is refused, never answered with another row. | red, waits on 2 |
| 2 | `m1-sheet-reads-gate-output` | At least one sheet (the flow split or the bitemporal staircase) renders from output that Rezono's gate produced at the pinned Rezono commit, recorded by CI as `fixtures/10-slip-reader-answers.json` is. A hand-written fixture may remain only if a test holds every row it has equal to that output. The `ReaderClient` loaders of #31 do not meet this: every sheet still renders a hand-written fixture. | red |
| 3a | `m1-slip-proof-tree` | The slip shows the proof as a tree: Rezono's filled `means` sentence, the legal or vendor sources (`@`) as leaves, and the checker's seal. | red |
| 3b | `m1-slip-all-witnesses` | The slip shows every distinct witness the reader publishes for a conclusion, not only the shortest. | red, waits on 3a |
| 3c | `m1-slip-why-not-why-unknown` | "Why not" (Rezono's `contrast`) and "why unknown" (`gap`): which premise is missing, and for which role. Unique to Rezono's four states. | red, waits on 3a |
| 4 | `m1-time-valid-at-known-at` | Two global controls, "valid at" and "known at", apply to all sheets. The bitemporal staircase is their detail view. | red, waits on 2 |
| 5a | `m1-motion-between-epochs` | Motion only where it means something: the change between two epochs (what disappears, what appears), shown as `<del>`/`<ins>` like a fold, animated only under `prefers-reduced-motion: no-preference`. | red, waits on 4 |
| 5b | `m1-claims-match-build` | The "breathing", "60fps", "under 250 ms" and "cryptographic proof per mark" claims go, unless the same line names a green test that measures or verifies them. | red: `AGENTS.md` and a `delta-store.ts` comment still claim under 250 ms |
| 6a | `m1-absent-never-valid-colour` | Absent never takes the valid colour. | red: Monge round dots in absent rounds are still `var(--c-valid)` |
| 6b | `m1-unknown-has-no-magnitude` | Unknown never carries a height or a size. | green |
| 6c | `m1-invalid-drawn-everywhere` | Invalid is drawn with `!` on every sheet and listed in the specimen. | red: since #28 the key has no `invalid` sign, #30 draws invalid as violated (✕), and the relief sheet throws on it |
| 6d | `m1-retractions-applied` | Retractions (weight −1) are applied, never drawn as rows. | green |
| 6e | `m1-no-borrowed-proof-refs` | No mark borrows another mark's proof reference. | red: the relief sheet gives one conclusion two keys (`A003`, `curtain:A003`) |
| 6f | `m1-signs-only-from-contract` | Only signs defined in the contract are emitted. | green |
| 6g | `m1-stated-observed-one-convention` | One line convention: stated dashed `6 3` (the drift dash of Rezono's key), observed solid, each track with its own side reference. | green |
| 7a | `m1-contrast-wcag-aa` | WCAG AA 4.5:1 for every ink and sign token, and axe's colour-contrast check really decides. | red: the tokens pass since #32, but in Happy-DOM axe answers "incomplete" and a 3:1 text still passes |
| 7b | `m1-forced-colors-reduced-motion` | Under `forced-colors: active` every colour token maps to a system colour; every animation or transition is opt-in under `prefers-reduced-motion: no-preference`. | red: no forced-colors mapping |

Items 3 and 5 of the owner's list are split, because their parts are answered by different reader questions or touch
different files. Item 7 is split because the contrast check needs a layout engine (a devDependency, which only a planner
adds), while the forced-colors and reduced-motion checks do not.

### 3. M2, entry and understanding

| # | Red test | What is accepted |
| --- | --- | --- |
| 8 | `m2-question-desk` | The entry page starts from Rezono's declared questions, and for a citizen from their own case. An optional LLM front answers only through declared Rezono questions and always shows the question used, its parameters and its witness. Without that it says "unknown, because …". It never shows free text without a Rezono row. |
| 9 | `m2-coverage-sheet` | Per declared question: answered with proof, unknown, or untested; and which kinds or slots go unused (after Stardog Designer's question scoring). |
| 10 | `m2-key-page` | All conclusions about one key (a person, a service), per role, under the time controls. "Path" means the derivation chain between two conclusions. |
| 11 | `m2-pinned-share-links` | A shared link carries a conclusion's address. The recipient sees only their role's part, and a 410 page if it was withdrawn. |
| 12 | `m2-try-kits` | One-click demos (healthcare allowance, tax return, platform) with a `suppose` toggle that shows how the conclusion and its proof tip over. |
| V1 | `m2-typeface-plex-self-hosted` | One real typeface pair, self-hosted (for example IBM Plex Sans and Plex Mono, both OFL-1.1). |
| V2 | `m2-hatch-signature` | The ▨ hatch for unknown is one signature with the geometry of Rezono's key (spacing 6, angle 45, width 1), the same on every sheet, the slip and the specimen. |
| V3 | `m2-messages-nl-en-no-raw-codes` | Dutch and English through Rezono's MF2 messages; never a raw `snake_case` code shown as text. After #31, sheet 05 still shows `income_statement_not_received` and sheet 02 `origin_design`. |
| A1 | `m2-table-first-no-hairball` | Table first; a node-link graph only for distance-1 neighbours of one conclusion. |
| A2 | `m2-no-silent-omission` | What a role may not read is said ("not readable for your role"), never silently left out, and without leaking what or how much. |

### 4. M3, for builders

| # | Red test | What is accepted |
| --- | --- | --- |
| 13 | `m3-engine-sheet` | Per relation: whether DuckDB and Feldera agree, the pipeline budget and the cost of deltas (after Stardog's visual query plans). |

### 5. Parked

No new work on these until M1 is green. Their existing green tests stay green; a parked sheet still gets the M1
principle fixes, because a parked sheet may not lie.

- **Monge folding** (sheet 06), until its z-axis carries data meaning.
- **The duplicate Pixi canvas** (`ripple-pixi.ts`): remove it, or keep a single renderer. (#31 made it read the one
  palette; whether to keep it is the parked question.)
- **PDF export** (Typst), until real data exists.
- **three.js 3D.** 3D is allowed only where both axes mean something, such as the relief of an amount over two
  inputs with cliffs at Rezono's verified turning points.

### 6. Relation to Decision 0011 and to the slip-port work

- Decision 0011's four M4 tests are green (#30 to #33) and stay green. This decision does not reopen them; its own
  tests above check the same findings independently and name what is still open.
- Issue #23 §2 (seal, trust tier and roles from the reader, no injected seals, no self-sealing, reader computations out
  of the page) and §3 (one Rezono pin, the nightly job against Rezono) belong to the work that ports the slip. This
  decision references them and writes no tests for them. `m1-sheet-reads-gate-output` uses whichever single Rezono pin
  that work leaves.

### 7. Visual direction

- Keep the swisstopo palette, with the contrast fixed (`m1-contrast-wcag-aa`). Rezono's own
  `packs/std-view/palette.yaml` states its ratios and is the first place to look for AA values.
- One real typeface pair, self-hosted (`m2-typeface-plex-self-hosted`). Fonts are assets, not code; OFL-1.1 is allowed
  for self-hosted font files and their licence text ships next to them. No font is fetched from a third-party host.
  Rezono's key names `system-ui` and `ui-monospace` today; the pair is proposed there too, so the key stays one.
- The ▨ hatch for unknown becomes Cartouche's visual signature (`m2-hatch-signature`).
- Dutch and English through Rezono's MF2 messages (`m2-messages-nl-en-no-raw-codes`).

### 8. What users dislike in RDFox and Stardog, avoided

- **No hairballs.** Table first; a graph only for distance-1 neighbours of one conclusion, each neighbour a link to
  its own slip (`m2-table-first-no-hairball`).
- **No silent omissions.** Say "not readable for your role", without counts, names or placeholders
  (`m2-no-silent-omission`, AGENTS.md rule 6).

### 9. How these red tests work

- **Executable where possible.** On promotion a worker keeps every assertion. A worker may change how a test obtains
  its input (for example a recorded gate fixture instead of a hand-written one) and may add assertions. Removing or
  weakening an assertion needs a planner PR.
- **Acceptance first where nothing exists yet.** The other tests state their acceptance in `assert.fail`, one numbered
  point per assertion. The worker who promotes one writes those assertions against recorded Rezono output.
- **The reader decides (Decision 0001).** Where Rezono's reader does not publish what a test needs (an address, a
  second witness, the role a premise is missing for, an `invalid` sign in Rezono's key), Cartouche does not compute
  it. The worker opens an issue in rezono-lang/rezono, links it from the PR, and the test stays red.
- **Contracts.** Only a planner bumps `contracts/` (Decision 0007). These tests use existing marks and plain HTML
  (`a[href]`, `input[name]`, `<del>`/`<ins>`, `@media`) where they can. A new `data-*` mark, the `invalid` sign once
  Rezono's key has it, and the layout-engine devDependency for 7a go through a planner PR.
- **Shared files.** 6a, 6c and 6e touch the same sheet files. The coordinator gives one worker one sheet file at a
  time.

## Consequences

- The board shows M1 first: 13 open M1 tasks (8 ready), then 10 M2 tasks and 1 M3 task that wait on all of them.
- Four M1 checks (6b, 6d, 6f, 6g) are green on arrival and guard the M4 fixes.
- Decision 0003's six sheets stay as the grammar. Its order and its "breathing" are superseded by this decision.
