---
id: 0010-projection-gaps-wave-2
status: proposed
milestone: M2
owner: planner
created: 2026-11-21
---

# Decision 0010: Projection Gaps Found During Wave 2

## Context
Wave 2 sheets compile only what the server publishes (Rule 1, Rule 2). Review found five places where the frozen contracts or golden fixtures do not publish a value the sheets need. Workers correctly refused to fill the gaps on the client, because a derived or borrowed value would break zero client compute and proof-per-mark. This note lists the gaps for a planner bump. It edits no contract and no fixture.

## Gaps

| # | Board ref | Where | Gap | Current honest behaviour |
|---|-----------|-------|-----|--------------------------|
| 1 | #24 | `contracts/cartouche-scene.v2.schema.json`, bitemporal compiler | The v2 IR has no `z` field, so the bitemporal `z_norm` of the staircase is not part of the scene. | `BitemporalStairSheet` (PR #11, verified #78) reads the published `z_norm` straight from the fixture as an opaque CSS `--z` token in `bitemporal-model.ts`, outside the IR. There is no JS arithmetic on the value. |
| 2 | #91 (P2) | `fixtures/04-subsidy-a001-a003.json` | `cliff_distance_display` has no published proof reference of its own. | The cliff marker would have to borrow the amount cell's `proof_ref`, which witnesses a different value. Workers must not do this. The relief sheet (#104) draws no SVG cliff marker, and the display stays as text in the twin row. |
| 3 | #88 (P1) | `fixtures/06-keycloak-dense-28.json` | Fixture 06 publishes no causal `edges`. | The ripple sheet draws the hop columns or rings only, with no connectors and no `data-relation`. Edges between consecutive hops must not be inferred. |
| 4 | #99, #103 | Scene IR (flow and monge nodes) | Flow and monge scene nodes do not carry the unknown `reason` (only cells and manifolds do). | `typst-export` takes a caller-supplied `reasonByNodeId` stopgap, and throws without it. It must be removed once nodes carry reasons. |
| 5 | #105 | `fixtures/08-monge-4d-audit.json` | Fixture 08 publishes raw `x`/`y` numbers with no display tokens. | Twins cannot show them without client formatting such as `toFixed`, which breaks zero compute. The values are used for geometry only, and the twin omits them. |

## Proposal
1. **Gap 1.** Move `z` into the IR: an optional, server-published `z` (with a `dimension` name and `proof_ref`) on the v2 scene node schema, so every sheet reads it from the scene and not from raw fixtures. `scene-ir` passes it through opaquely, and the `xD-Discipline Guard` still rejects any nominal-ID Z axis.
2. **Gap 2.** Add `cliff_distance_proof_ref` next to `cliff_distance_display` in fixture 04 and in the `sweep_2d` projection schema. The marker shows only the published display, linked to this ref.
3. **Gap 3.** Add `edges[]` to fixture 06 (`from`, `to`, `relation`, `proof_ref`) and to the `cut_set` projection schema. Until it lands, sheets draw no connectors.
4. **Gap 4.** Add an optional published `reason` to flow and monge scene nodes for the `unknown` state, then delete `reasonByNodeId` from `typst-export`.
5. **Gap 5.** Publish display tokens (`x_display`, `y_display`) next to `x`/`y` in fixture 08 and the `monge` payload schema. Twins show only those tokens.

## Consequences
- Contract changes need a planner decision bump, a new `contracts/freeze-lock.json`, and pre-merge review (see Decision 0007).
- Workers keep the honest fallbacks above until the bump merges.
- Gap 1 changes where `z` is read from, not whether the stair is drawn. The cliff proof link, the ripple edges, the monge X/Y twin columns and the typst node reasons wait for their bumps.