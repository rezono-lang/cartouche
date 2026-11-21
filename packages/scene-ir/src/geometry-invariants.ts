/**
 * Decision 0002 & Rezono Lesson 8: Headless Geometric & Epistemic Invariants (<20ms).
 * Catches visual layout regressions (label overlaps, Monge collisions, missing dual drift proofs,
 * digits leaking into unknown cells) BEFORE pixels or browsers ever run.
 */

import type { BoundingBox, CartoucheScene } from './types.ts';

export interface InvariantViolation {
  readonly code: string;
  readonly message: string;
}

const DIGIT_RE = /\d/;

function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function checkGeometricInvariants(scene: CartoucheScene): readonly InvariantViolation[] {
  const errors: InvariantViolation[] = [];

  // 1. Zero bounding-box overlap among rendered node cards
  for (let i = 0; i < scene.nodes.length; i++) {
    for (let j = i + 1; j < scene.nodes.length; j++) {
      const a = scene.nodes[i]!;
      const b = scene.nodes[j]!;
      if (boxesOverlap(a.box, b.box)) {
        errors.push({
          code: 'GEOM_BBOX_OVERLAP',
          message: `Node "${a.id}" overlaps node "${b.id}" on sheet "${scene.archetype}".`
        });
      }
    }
  }

  // 2. Monge-Vouwblad invariant: strictly unique X and strictly unique Y across all services!
  if (scene.archetype === 'monge-fold') {
    const seenX = new Map<string, string>();
    const seenY = new Map<string, string>();
    for (const n of scene.nodes) {
      if (!n.mongeCoords) {
        errors.push({ code: 'MONGE_MISSING_COORDS', message: `Monge node "${n.id}" missing mongeCoords.` });
        continue;
      }
      const xk = n.mongeCoords.x.toFixed(2);
      const yk = n.mongeCoords.y.toFixed(2);
      if (seenX.has(xk)) {
        errors.push({
          code: 'MONGE_X_COLLISION',
          message: `Monge Plane II collision: "${n.id}" and "${seenX.get(xk)}" share x=${xk}.`
        });
      }
      if (seenY.has(yk)) {
        errors.push({
          code: 'MONGE_Y_COLLISION',
          message: `Monge Plane III collision: "${n.id}" and "${seenY.get(yk)}" share y=${yk}.`
        });
      }
      seenX.set(xk, n.id);
      seenY.set(yk, n.id);
    }
  }

  // 3. Proof-per-mark & epistemic integrity on nodes
  for (const n of scene.nodes) {
    if (!n.proofRef || n.proofRef.trim().length === 0) {
      errors.push({ code: 'EPI_MISSING_PROOF', message: `Node "${n.id}" has no proofRef.` });
    }
    if (n.state === 'absent' && !n.completenessWitnessRef) {
      errors.push({
        code: 'EPI_ABSENT_NO_SWEEP',
        message: `Absent node "${n.id}" must cite a completenessWitnessRef (complete_sweep).`
      });
    }
    if (n.state === 'unknown' && n.cell?.display != null && DIGIT_RE.test(n.cell.display)) {
      errors.push({
        code: 'EPI_UNKNOWN_HAS_DIGIT',
        message: `Unknown node "${n.id}" leaked a digit in display: "${n.cell.display}".`
      });
    }
  }

  // 4. Every DRIFT edge must link BOTH stated and observed proofs
  for (const d of scene.driftEdges) {
    if (!d.statedProofRef || !d.observedProofRef) {
      errors.push({
        code: 'EPI_DRIFT_SINGLE_SIDED',
        message: `Drift edge "${d.id}" must carry both statedProofRef and observedProofRef.`
      });
    }
  }

  return Object.freeze(errors);
}
