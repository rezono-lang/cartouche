---
id: 0009-slip-reads-rezono-reader
status: accepted
milestone: M2
owner: slip
created: 2026-11-21
---

# Decision 0009: The Slip Reads Rezono's Reader — One Slip, One Numbering, One Key

## Context
Decision 0006 made Cartouche the home of the slip and of the seven conformance requirements Rezono specified for it
(Rezono `decisions/viewer-slip.md`). Cartouche's slip (`Slip.svelte`, `slip-element.ts`, `slip-verbs.ts`,
`SlipSweep.svelte`) is green on all seven, but only over `fixtures/09-slip-conformance.json`: a projection written by
hand (display cells, links, answered verbs, stops with `fold_display`). Nothing produces that shape from a publication.
Rezono's own slip (`viewer/slip/` at rezono-lang/rezono@f15c89d665e2815b02e12665203a9d48dd6abc40) produces it from the
answers of Rezono's reader, in the browser (`viewer/slip/src/model.ts`). Rezono retires that slip once Cartouche's reads
the reader. Until then there are two slips, and they already differ:

| Point | Rezono (`decisions/viewer-slip.md`) | Cartouche today |
| --- | --- | --- |
| `tr[data-line]` | the line's index from 0; a sentence variable links with that index | counted from 1 |
| calculation steps | lines: `tr[data-line][data-path]` with relation, key and verbs | `tr[data-path]` only, plus a result row |
| stops of a sweep | `[data-stop]` inside the line of the swept cell | a separate strip |
| fold | from the variant's published difference (`scenario`) | a hand-written `fold_display` |
| sentence | `rule.<id>` filled by `viewer/messages/src/fill.ts` (MF2) | `{$x}` split in the page |
| served seal | `reader-hashes` and `publisher-record` as the reader served them | `witness` unless a caller passes checks |
| fixture 09 vs the reader | stop 5 turns `same`; the red stop's check is the invariant `too_large` | `turns`; `max_amount_limit` |

The frozen contracts (Decision 0007) also differ from Rezono's `packs/std-view` at that commit:

- sign names: Rezono `origin_decision`, `origin_vendor`, `origin_design`, `origin_observation`, `derived`, `assumption`,
  `drift`, `screened`, `proposal`, `sealed`, `supposed`, statuses `valid`, `changed`, `violated`, `unknown`,
  `not_applicable`, `absent`; Cartouche `SIGNS` / `data-sign` freeze `decision`, `legislator`, `design`, `observation`,
  `invalid` and lack `assumption`, `screened`, `proposal`, `sealed`;
- verbs: Rezono's `Sheets.verbs` give `suppose`, `compare` and `propose` no question (they are actions of the viewer);
  Cartouche's `STD_VERBS` freeze the questions `sweep`, `scenario` and `propose`;
- `contracts/rezono-pin.json` pins rezono `bce08a52`, which predates the message filler and the slip.

## Decision
1. **The reader is the source.** `@rezono/slip` ports Rezono's view model to `packages/slip/src/model.ts`. It runs at
   build time inside `packages/slip/bin/render.ts`, never in the page bundle (Decision 0001): it asks the reader's routes
   (`head`, `bundle`, `rows`, `ask/<question>`, `sweeps`) through a handler, turns the answers into the props of the one
   `Slip.svelte`, and precomputes every answer table, stop and fold the page can open. The page shows and toggles; it
   pairs, parses and fills nothing. Each computation the model does that belongs in Rezono's reader is listed in the
   model's header, so it can move there.
2. **Consumed, not copied.** Rezono's message filler (`viewer/messages/src/fill.ts`) and std packs
   (`packs/std-view/{sheets,key}.yaml`, `packs/std-view/messages/*.mf2`, `packs/std-explain/messages/*.mf2`) are read at
   one Rezono commit named in `packages/slip/rezono-source.json` with the SHA-256 of each file; the loader fetches them
   from that commit and refuses any other bytes. Every sentence is filled by `fill.ts`; no page does `{$x}` substitution.
3. **Recorded answers.** `fixtures/10-slip-reader-answers.json` records what Rezono's reader answers for Rezono's
   `tests/fixtures/slip` at that commit (the main publication and the sweeps publication, roles `reader` and `summary`),
   with how each answer was obtained. PR CI renders from it. A Rezono reader may also be plugged in through `reader`.
4. **Rezono's marks win.** `tr[data-line]` is the line's index from 0 and a sentence variable links with it; a
   calculation step is a line; the stops of a sweep stand inside the swept line; a fold comes from the published
   difference; a served seal lists `reader-hashes` and `publisher-record` from the reader's record. This applies to every
   way into `render`, fixture 09 included.
5. **Fixture 09 cannot drift.** It stays as a small unit fixture only while a test holds every row it has equal to what
   the model produces from the recorded answers for the same row (lines, links, states, values, reasons, verbs, stops,
   folds). Cartouche-only annotations (proof and completeness references) are named as such.
6. **No silent second key.** The frozen-contract differences above are held by a red test. Closing it bumps
   `contracts/std-view.v2.tokens.json`, `contracts/data-marks.json` and `contracts/rezono-pin.json` under Decision 0007,
   with owner review. Until then the slip draws only signs both keys have (Rezono's rule: a sign not in the key is not
   drawn) and says which it left out.

## Red tests
- `tests/red/m2-slip-reads-rezono-reader.test.mjs` (points 1–4)
- `tests/red/m2-slip-fixture-09-matches-reader.test.mjs` (point 5)
- `tests/red/m3-std-view-matches-rezono.test.mjs` (point 6; waits on owner review of the contract bump)

## The contract bump (point 6), proposed for owner review
- One pin: `contracts/rezono-pin.json` `pinned_commit` is the full commit the slip reads
  (f15c89d665e2815b02e12665203a9d48dd6abc40); `packages/slip/rezono-source.json` keeps only the files and their hashes,
  and the reader-parity workflow reads the same pin.
- Signs: Rezono's `key.yaml` signs and statuses, by name: `origin_decision`, `origin_vendor`, `origin_design`,
  `origin_observation`, `derived`, `assumption`, `drift`, `screened`, `proposal`, `sealed`, `supposed`, `valid`,
  `changed`, `violated`, `unknown`, `not_applicable`, `absent`. Rezono's glyph wherever it has one. Where Rezono draws a
  form instead, Cartouche's non-colour glyphs are proposals: `assumption` ‗ (underline), `screened` ▬ (bar),
  `sealed` ⊛ (stamp); `drift` ══ and `supposed` ◇ stay.
- `invalid` is no sign: an invalid value is drawn with `violated` and its reason, as Rezono's slip does
  (`signForState`). This answers the quality review's request for `!` on invalid differently: the owner chooses.
- Verbs: `suppose`, `compare` and `propose` have no question (actions of the viewer), as `Sheets.verbs` says.
