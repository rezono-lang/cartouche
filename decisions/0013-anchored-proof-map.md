---
id: 0013-anchored-proof-map
status: accepted
milestone: M3
owner: planner
created: 2026-11-21
decided_by: owner
---

# Decision 0013: The Anchored Proof Map — Reasoning Placed on What It Is About

## Context

Decision 0012's proof map (§3a) lays a proof out by derivation. Many of Rezono's conclusions are about things that have a place: a parcel, a building, a room, a rack slot, a device, a road segment. People ask "what holds here, and why?" as often as they ask "why does this hold?".

On 21-11 the owner reviewed two throwaway prototypes. In each, the proof map floated above a 3D scene of the things it was about:
- each conclusion stood above its anchor, higher the more derivation steps it took;
- unknown, invalid and violated conclusions were visible at a glance where they applied;
- the measured points that carried a proof were highlighted in the scene.

The owner asked for a generic plan that does not depend on those examples. This decision is that plan. It adds one view, the anchored proof map, to the proof map of Decision 0012. It does not change 0012's order: nothing here starts before M1 is green and the proof map's layout, glyphs and proof-in-place are green.

## Decision

### 1. One graph, two layouts

- **Same scene, two layouts.** The anchored proof map shows the same rows and edges as the proof map (0012 §3a) and lays them out in two ways: **by derivation** (0012's semantic layout) and **by place**.
- **One control between them.** It moves continuously from one layout to the other. Ids, edges, glyphs and the selection stay the same in both.
- **By place, every row stands above its anchor.** The horizontal position is the anchor's place. The height is the row's derivation stratum: stated facts lowest, each derivation step one level higher.
- **Both axes mean something,** as 0012 §5 requires for 3D: place is place, and height is an ordinal count of steps, never an amount.
- **Things stand on their anchor.** The things a case is about (its keyed entities) stand directly on their anchor, below the facts.

### 2. Who computes what

Decision 0001 holds unchanged.

| Where | What |
| --- | --- |
| Rezono (gate, publisher, reader) | The anchor of every row, as published data. The stratum. The witness, including the measured points a measurement rests on. What each role may read, including whether it may read a place. The worlds that `suppose` asks for. Every value and every state. |
| Cartouche scene compiler, at build time | Turning a served anchor into scene coordinates, with one fixed transform per grid. The derivation layout (0012). Level-of-detail bands per partonomy level. Thinning reference layers for display. All of it deterministic, recorded in the scene IR and tested headlessly. |
| Cartouche client | Drawing and projecting 3D to the screen. Linear interpolation between two served positions, for the layout control and for motion between epochs. Picking, culling, and choosing level of detail by camera distance against served bands. Nothing else: no position computed from a value, no aggregation, no sorting by value, no visibility decided by a value. |

`scripts/zero-compute-lint.mjs` and the domain check cover the place view and `apps/` (issue #46, points 2 and 16).

### 3. Anchors

- **Rezono publishes the anchor.**
  - It is a path in a partonomy, for example site › building › room › row › rack › slot.
  - It ends in integer coordinates on a declared grid with its unit. The grid follows Rezono's exact geometry design: a projected national grid in millimetres, a geographic grid in 10⁻⁷ degree, or a local grid such as a room in millimetres or a rack in rack units.
  - A footprint, when served, is a polygon on that grid.
- **Cartouche never makes an anchor.** It never geocodes, never parses an address, never infers a place from a label, and never snaps. A row without a served anchor stays in the derivation layout. In the place layout it sits in an "unplaced" tray, never at a guessed place.
- **A contested anchor is shown as contested.** When Rezono serves `invalid` for a place (two sources, two places), Cartouche draws both candidate places and the conflict line between them, both taken from the witness. It never picks one.
- **A moved thing moves.** An anchor that changes between epochs is shown by the motion between epochs (0012 M1 5a).
- **No anchors, no view.** Until Rezono serves anchors, this view does not exist. Cartouche reads no field that Rezono does not serve (issue #46, point 4). The fields it needs are listed in §9.

### 4. The grammar in space

- **The key's glyphs, extruded.** One glyph never means two things, in 2D or in 3D:
  - a stated fact carries its origin glyph: ◆ decision, ▲ vendor, ■ design, ● observation;
  - ○ derived;
  - ◇ supposed;
  - ▨ unknown: hatched, with dashed edges, never at height zero (0002 §2);
  - ⦸ absent, only with a complete sweep;
  - ! invalid;
  - ✕ violated norm.
- **An unknown points at what it waits for.** When it waits on a source, a dashed line runs to that source, as the reader's gap names it.
- **Sources are flags.** They stand around the scene, or at their own anchor if they have one. Selecting a proof draws lines from its facts to their sources.
- **The proof lights up in place.** Selecting a conclusion highlights its witness in place, as 0012 §3a requirement 4 asks. The slip is the side panel.

### 5. Evidence to the point

- **The reader serves the measurement's witness.** When a fact is a measurement over a point cloud, a raster or a scan, the witness consists of:
  - the identifiers of the points it rests on, or their hash together with a clip volume;
  - the statistic it used;
  - its value.
- **Cartouche only shows that witness.** It highlights exactly those points and the clip volume, and draws the profile the reader serves. It never computes the statistic, picks other points or measures again.

### 6. Semantic zoom

- **The partonomy sets the levels of detail.** The compiler serves a camera-distance band for each level. A level's labels show only inside its band.
- **Containers open as you enter them.** A roof, a wall or a cabinet door fades when the camera passes inside it.
- **Labels never pile up.** Their density per screen region is bounded by a rule recorded in the scene, and higher strata win, so conclusions are read first.
- **Groups fold from afar.** Seen from far away, a group of things is one chip carrying the count the reader publishes (0012 A1). It opens on request.

### 7. Roles and places

- **The role lens of 0012 applies** (P6, A2).
- **A place can itself be personal:** a home, or a person's plot. Whether a role may read a place is the reader's call. It serves the full anchor, a coarser level of the partonomy, or no anchor.
- **Cartouche draws what is served:** at the coarser level, or in the unplaced tray. It never shows a hidden thing's place. It shows no placeholder and no count that the reader did not publish (AGENTS.md rule 6).

### 8. Time and suppose

- **The time controls apply.** "Valid at" and "known at" (0012 M1 4) work in the place view too.
- **`suppose` shows a served world.** Turning it on shows the world the reader serves for it: which marks change state, which things go dark, which conclusions tip.
- **Cartouche only compares.** It shows the difference between two served worlds and computes neither of them.

### 9. What Rezono must serve

Each item below becomes a Rezono issue before any red test that needs it is promoted. Nothing is read before Rezono serves it.

1. An `anchor` for each row or keyed thing: the partonomy path, the grid identifier and unit, the integer coordinates, an optional footprint, all per epoch.
2. The derivation stratum of every published row.
3. For measured facts: the witness points, or their hash with a clip volume, plus the statistic and its value.
4. The role decision for places: the full anchor, a coarser level, or none.
5. Served worlds for `suppose` (already asked for by `m2-proof-map-suppose`).

### 10. Reference layers

- **Context, not proof.** A base map, a terrain or building point cloud and a building model are reference layers, drawn behind the data.
- **Thinned at build time,** and shown with their own licence and attribution.
- **Never a premise of a proof** unless a witness lists them (§5).

### 11. Camera

- **0002 requires orthographic 3D.** Its §2 asks for orthographic projection so that perspective never distorts a magnitude.
- **The place layout encodes no magnitude by size or height.** Sizes are fixed per glyph, and height is an ordinal stratum.
- **So this decision amends 0002 for the place layout only.** A perspective camera is allowed when the scene IR declares that no channel encodes a magnitude by size or height, and `packages/scene-ir/src/xd-guard.ts` checks that declaration. Every other 3D sheet stays orthographic.
- **Orthographic is still the default.** Perspective is a viewer's choice, for walking into a room.

### 12. Accessible, and measured

- **A table twin** lists every placed row with its anchor path, state, value and stratum.
- **Keyboard walking** follows edges and the partonomy. The slip reads rows as sentences through MF2 (0012 V3).
- **Reduced motion is respected.** Under `prefers-reduced-motion: reduce`, the layout control and camera moves jump instead of animating.
- **Performance is measured, not claimed** (0012 5b).
  - **Budget:** a recorded scene with at least 200,000 reference points and 2,000 marks keeps a 95th-percentile frame time at or under 16.7 ms on the CI GPU runner.
  - **Renderer:** the single WebGL renderer of `m2-proof-map-scale`.

### 13. How these red tests work

Decision 0012 §9 applies, with one stricter rule. Issue #46 found that M4's `assert.fail` to-do lists were turned green by tests written in the same PR as the fix. So:

- **A planner goes first.** Before a worker may claim an `m3-place-*` task, a planner PR records the fixture from Rezono's reader and turns that task's numbered acceptance points into executable assertions against it, with hand-checked expectations.
- **Then the worker.** The worker makes those assertions pass and does not edit them.

## Red tests (M3)

All of these wait on the open M1 tests and on the proof map's layout, glyphs and proof-in-place. Tasks 3 to 11 also wait on tasks 1 and 2.

| # | Red test | What is accepted |
| --- | --- | --- |
| 1 | `m3-place-anchors-from-reader` | Every placed mark's position equals the compiler's fixed transform of the anchor the reader served, for every grid in the fixture. A row without an anchor is in the unplaced tray. No code path makes a place from a label: changing a label in the fixture leaves every position unchanged. |
| 2 | `m3-place-two-layouts-one-graph` | Both layouts have the same ids, edges, glyphs and selection. The client's only arithmetic on positions is linear interpolation between two served positions (lint). Height equals the stratum times the served step. |
| 3 | `m3-place-contested-anchor` | For a place served as `invalid`, both candidate places are drawn and joined by the conflict line from the witness. No mark stands at one of them alone. The slip names both sources. |
| 4 | `m3-place-evidence-to-the-point` | The highlighted points equal the witness point ids exactly (set equality with the recorded witness). The clip volume and the profile come from the reader. Changing a point coordinate in the client changes no displayed value (opaque-token mutation). |
| 5 | `m3-place-semantic-zoom` | Level bands come from the scene. In each band, the visible labels are exactly the ones the scene lists for it. Containers fade on entry. The label density bound holds in a headless check. Chips show only published counts. |
| 6 | `m3-place-roles-and-places` | For a role whose reader output withholds or coarsens an anchor, no finer coordinate appears anywhere: not in the scene IR, the table twin, the DOM or hashed state. There is no placeholder and no count unless the reader published it. |
| 7 | `m3-place-time-and-suppose` | Changing "known at" or turning on `suppose` swaps between served worlds. A mark whose anchor changed moves between its two served positions. The client computes no state. |
| 8 | `m3-place-reference-layers` | Reference layers carry their licence and attribution in the scene and are thinned at build time. They are never listed as a premise unless a witness names them. |
| 9 | `m3-place-camera-honesty` | The xD guard accepts perspective only for a scene that declares no magnitude channel by size or height. It rejects the same scene once a size is bound to a value. Orthographic is the default. |
| 10 | `m3-place-accessible-twin` | The table twin holds the anchor path, state, value and stratum of every placed row. Keyboard walking follows edges and the partonomy. Reduced motion jumps. Messages come through MF2. |
| 11 | `m3-place-scale-measured` | The frame-time budget of §12 is measured on a recorded scene: at least 200,000 points and 2,000 marks, 95th percentile at or under 16.7 ms on CI. The test records the first-render budget it measures. |

## Considered and rejected

- **Geocoding or snapping in Cartouche.** A place is a premise. It belongs to Rezono, together with its source.
- **A force-directed or physics layout for the place view.** It is not deterministic, and it moves things away from where they are.
- **Spherical tiles (H3, S2) in the place view's proof.** They are for display only, as in Rezono's geometry design.
- **Choosing one place for a contested thing.** That would answer a question Rezono left `invalid`.
- **Computing a percentile or a width from points in the browser.** A measurement is Rezono's fact; Cartouche shows its witness.
- **A domain-specific sheet per example.** The view is generic. Examples live only in `fixtures/`, and the domain check covers `packages/` and `apps/`.

## Consequences

- The proof map gains a second layout, not a second renderer.
- Rezono needs an anchor contract (§9) before anything here can be promoted. Those issues come first.
- Decision 0002 gains one exception, which the xD guard checks.
- The board gains 11 M3 tasks. All wait on M1 and on the proof map; none can be claimed before §13's planner step.
