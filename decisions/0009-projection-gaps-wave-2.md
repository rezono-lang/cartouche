---
id: 0009-projection-gaps-wave-2
status: proposed
milestone: M2
owner: planner
created: 2026-11-21
---

# Decision 0009: Projection Gaps Found During Wave 2

## Context
Wave 2 sheets compile only what the server publishes (Rule 1, Rule 2). Review found three places where the frozen contracts or golden fixtures do not publish a value the sheets need. Workers correctly refused to fill the gaps on the client, because a derived or borrowed value would break zero client compute and proof-per-mark. This note lists the gaps for a planner bump. It edits no contract and no fixture.

## Gaps

| # | Board ref | Where | Gap | Current honest behaviour |
|---|-----------|-------|-----|--------------------------|
| 1 | #24 | `contracts/cartouche-scene.v2.schema.json`, bitemporal compiler | The v2 IR has no `z` field, so the bitemporal `z_norm` of the staircase cannot be projected. | The compiler emits the 2D matrix only. No client-side z is derived. |
| 2 | #91 (P2) | `fixtures/04-subsidy-a001-a003.json` | `cliff_distance_display` has no published proof reference of its own. | The cliff marker would have to borrow the amount cell's `proof_ref`, which witnesses a different value. Workers must not do this. |
| 3 | #88 (P1) | `fixtures/06-keycloak-dense-28.json` | Fixture 06 publishes no causal `edges`. | The ripple sheet draws the hop columns or rings only, with no connectors and no `data-relation`. Edges between consecutive hops must not be inferred. |

## Proposal
1. **Gap 1.** Add an optional, server-published `z` (normalised, with a `dimension` name and `proof_ref`) to the v2 scene node schema. `scene-ir` must pass it through opaquely, and the `xD-Discipline Guard` still rejects any nominal-ID Z axis.
2. **Gap 2.** Add `cliff_distance_proof_ref` next to `cliff_distance_display` in fixture 04 and in the `sweep_2d` projection schema. The marker shows only the published display, linked to this ref.
3. **Gap 3.** Add `edges[]` to fixture 06 (`from`, `to`, `relation`, `proof_ref`) and to the `cut_set` projection schema. Until it lands, sheets draw no connectors.

## Consequences
- Contract changes need a planner decision bump, a new `contracts/freeze-lock.json`, and pre-merge review (see Decision 0007).
- Workers keep the honest fallbacks above until the bump merges.
- Only after the bump may sheets draw the z stair, the cliff proof link, or the ripple edges.