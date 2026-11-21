---
id: 0002-cartouche-scene-ir-and-xd-discipline
status: accepted
milestone: M0
owner: scene-ir
created: 2026-11-21
---

# Decision 0002: CartoucheScene v2 IR and the xD-Discipline Guard

## Context
Visual bugs and dishonest 3D charts (perspective distortion, nominal IDs mapped to continuous height, `unknown` drawn at `z = 0`, overlapping labels, colliding Monge coordinates) cannot be prevented by standard unit tests alone.

## Decision
1. Every sheet compiles deterministically into a `CartoucheScene` v2 IR before any DOM, SVG, WebGPU (`Threlte v8`), or `Typst` PDF output runs.
2. `packages/scene-ir/src/xd-guard.ts` enforces hard projection rules at compile time:
   - 3D projections MUST declare `projection: 'orthographic'` (perspective 3D is rejected).
   - Nominal dimensions (`D1` entity IDs, `D8` roles) MUST NOT bind to continuous `Z` height.
   - `unknown` (`▨`) MUST NOT render at height `z = 0`; in 3D it binds to a hatched vertical curtain (`uncertainty_curtain`) or prism.
3. `packages/scene-ir/src/geometry-invariants.ts` verifies headless geometric correctness in <20ms:
   - Zero bounding-box overlap among sibling node/label cards.
   - Strictly unique `x` and strictly unique `y` across all entities on a Monge folding sheet (preventing collisions on Plane II and Plane III).
   - Every `drift` (`══`) edge carries both `statedProofRef` and `observedProofRef`.
   - Every `absent` (`⦸`) mark carries a `completenessWitnessRef`.
