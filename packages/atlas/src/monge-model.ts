/**
 * Pure Headless Model & Orthographic Projection Engine for Sheet 06 (Monge-Vouwblad 4D Audit).
 * Decision 0002:
 *  - Reuses compileMongeScene + assertXDDiscipline + checkGeometricInvariants.
 *  - Zero perspective distortion: pure linear orthographic projection from 0° flat net to 90° prism.
 *  - Enforces strictly unique X (Plane II) and strictly unique Y (Plane III) across all entities.
 *  - Dual-sided drift proofs, hatched unknown curtain (never z=0), and witnessed absent marks.
 */

import { asOpaqueCell, SIGNS } from '../../reader-core/src/index.ts';
import type { EpistemicSign } from '../../reader-core/src/index.ts';
import { compileMongeScene } from '../../scene-ir/src/compilers.ts';
import { checkGeometricInvariants } from '../../scene-ir/src/geometry-invariants.ts';
import type { CartoucheScene } from '../../scene-ir/src/types.ts';
import type { ManifestMeta } from '../../reader-core/src/index.ts';

export type MongeNodeState = 'valid' | 'violated' | 'absent' | 'unknown' | 'invalid';

export interface MongeServiceInput {
  readonly id: string;
  readonly label: string;
  readonly short?: string;
  readonly sign: 'origin_decision' | 'origin_design';
  readonly x: number;
  readonly y: number;
  readonly state: MongeNodeState;
  readonly reason?: string | null;
  readonly display?: string | null;
  readonly round_states?: readonly MongeNodeState[];
  readonly round_proof_refs?: readonly (string | null)[];
  readonly proof_ref: string;
  readonly completeness_witness_ref?: string | null;
}

export interface MongeDriftArcInput {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly label: string;
  readonly proof_ref?: string | null;
  readonly stated_proof_ref: string;
  readonly observed_proof_ref: string;
}

export interface MongeFixtureInput {
  readonly fixture_id?: string;
  readonly manifest: ManifestMeta;
  readonly projection: 'orthographic';
  readonly fold_angle_deg?: number;
  readonly rounds?: readonly string[];
  readonly services: readonly MongeServiceInput[];
  readonly drift_arcs: readonly MongeDriftArcInput[];
}

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface MongeRoundMark {
  readonly roundId: string;
  readonly state: MongeNodeState;
  readonly sign: string;
  readonly proofRef: string | null;
  readonly plane2: Point2D;
  readonly plane3: Point2D;
}

export interface MongeServiceProjection {
  readonly id: string;
  readonly label: string;
  readonly short: string;
  readonly sign: EpistemicSign;
  readonly state: MongeNodeState;
  readonly reason: string | null;
  readonly proofRef: string;
  readonly completenessWitnessRef: string | null;
  readonly mongeCoords: { readonly x: number; readonly y: number };
  readonly plane1: Point2D;
  readonly rayToPlane2: readonly [Point2D, Point2D, Point2D];
  readonly rayToPlane3: readonly [Point2D, Point2D, Point2D];
  readonly unknownCurtain?: readonly [Point2D, Point2D, Point2D, Point2D];
  readonly rounds: readonly MongeRoundMark[];
}

export interface MongeDriftProjection {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly label: string;
  readonly proofRef: string | null;
  readonly statedProofRef: string;
  readonly observedProofRef: string;
  readonly statedPath: string;
  readonly observedPath: string;
  readonly midpoint: Point2D;
}

export interface MongePlaneQuad {
  readonly id: 'plane-1' | 'plane-2' | 'plane-3';
  readonly label: string;
  readonly points: string;
  readonly labelPos: Point2D;
}

export interface MongeFoldingModel {
  readonly scene: CartoucheScene;
  readonly foldAngleDeg: number;
  readonly projection: '2d' | 'orthographic';
  readonly rounds: readonly string[];
  readonly planes: readonly MongePlaneQuad[];
  readonly services: readonly MongeServiceProjection[];
  readonly driftArcs: readonly MongeDriftProjection[];
  readonly usedSigns: readonly string[];
  readonly viewBox: { readonly minX: number; readonly minY: number; readonly width: number; readonly height: number };
}

const DIGIT_RE = /[0-9]/;
const DEG_TO_RAD = Math.PI / 180;
const SCALE = 88;
const ORIGIN_X = 360;
const ORIGIN_Y = 300;
const PLANE_HALF_X = 2.0;
const PLANE_HALF_Y = 1.45;
const WALL_DEPTH = 1.65;
const CURTAIN_HEIGHT = 1.2;
const DRIFT_OFFSET = 5;

function assertValidSign(name: string): void {
  if (!Object.prototype.hasOwnProperty.call(SIGNS, name)) {
    throw new Error(`Unknown std-view sign: ${name}`);
  }
}

function stateToSign(state: MongeNodeState): string {
  return state;
}

export function normalizeFoldAngle(angleDeg: number | undefined): number {
  const raw = angleDeg === undefined ? 0 : angleDeg;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > 90) {
    throw new Error(`Monge fold angle must be a finite number in [0, 90], received ${String(raw)}.`);
  }
  return Math.trunc(raw);
}

interface FoldTrig {
  readonly cosFold: number;
  readonly sinFold: number;
  readonly cosY: number;
  readonly sinY: number;
  readonly cosP: number;
  readonly sinP: number;
}

// Exact cross-engine constants for the canonical 0° / 40° / 90° Monge fold presets.
const PRESET_TRIG: Readonly<Record<number, FoldTrig>> = Object.freeze({
  0: Object.freeze({ cosFold: 1, sinFold: 0, cosY: 1, sinY: 0, cosP: 1, sinP: 0 }),
  40: Object.freeze({
    cosFold: 0.766044443118978,
    sinFold: 0.6427876096865393,
    cosY: 0.9791843235052687,
    sinY: 0.20297305387890792,
    cosP: 0.9692012977199335,
    sinP: 0.24626986112392522
  }),
  90: Object.freeze({
    cosFold: 0,
    sinFold: 1,
    cosY: 0.8960506064381762,
    sinY: 0.44395192386200863,
    cosP: 0.8472551110134161,
    sinP: 0.5311861979208834
  })
});

function resolveFoldTrig(foldAngleDeg: number): FoldTrig {
  if (Object.prototype.hasOwnProperty.call(PRESET_TRIG, foldAngleDeg)) {
    return PRESET_TRIG[foldAngleDeg]!;
  }
  const foldRad = foldAngleDeg * DEG_TO_RAD;
  const blend = foldAngleDeg / 90;
  const yaw = 0.46 * blend;
  const pitch = 0.56 * blend;
  return {
    cosFold: Math.cos(foldRad),
    sinFold: Math.sin(foldRad),
    cosY: Math.cos(yaw),
    sinY: Math.sin(yaw),
    cosP: Math.cos(pitch),
    sinP: Math.sin(pitch)
  };
}

/**
 * Pure linear orthographic projection (zero perspective divide).
 * At foldAngleDeg = 0° it renders an exact top-down 2D flat net.
 * As foldAngleDeg increases toward 90°, it rotates smoothly into an orthographic axonometric view.
 */
function projectOrtho(x3: number, y3: number, z3: number, trig: FoldTrig): Point2D {
  const rx = x3 * trig.cosY - y3 * trig.sinY;
  const ry = x3 * trig.sinY + y3 * trig.cosY;

  const sx = ORIGIN_X + rx * SCALE;
  const sy = ORIGIN_Y - (ry * trig.cosP + z3 * trig.sinP) * SCALE;
  return { x: sx, y: sy };
}

function fmtPt(pt: Point2D): string {
  return `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`;
}

function quadToPoints(pts: readonly Point2D[]): string {
  return pts.map(fmtPt).join(' ');
}

function plane2Point(u: number, h: number, trig: FoldTrig): Point2D {
  const y3 = PLANE_HALF_Y + h * trig.cosFold;
  const z3 = h * trig.sinFold;
  return projectOrtho(u, y3, z3, trig);
}

function plane3Point(v: number, h: number, trig: FoldTrig): Point2D {
  const x3 = PLANE_HALF_X + h * trig.cosFold;
  const z3 = h * trig.sinFold;
  return projectOrtho(x3, v, z3, trig);
}

export function buildMongeFoldingModel(
  fixture: MongeFixtureInput,
  foldAngleOverride?: number
): MongeFoldingModel {
  const foldAngleDeg = normalizeFoldAngle(
    foldAngleOverride !== undefined ? foldAngleOverride : fixture.fold_angle_deg
  );
  const trig = resolveFoldTrig(foldAngleDeg);
  const projection: '2d' | 'orthographic' = foldAngleDeg === 0 ? '2d' : 'orthographic';

  // Compile via scene-ir compiler (enforces xD-Discipline Guard: Law 0, 1, 2, 3, 5).
  const scene = compileMongeScene({
    manifest: fixture.manifest,
    projection: fixture.projection,
    services: fixture.services.map((s) => ({
      id: s.id,
      label: s.label,
      sign: s.sign,
      x: s.x,
      y: s.y,
      state: s.state,
      proof_ref: s.proof_ref,
      ...(s.completeness_witness_ref ? { completeness_witness_ref: s.completeness_witness_ref } : {})
    })),
    drift_arcs: fixture.drift_arcs
  });

  // Enforce headless geometric & epistemic invariants (unique X, unique Y, dual drift proofs, absent sweep).
  const violations = checkGeometricInvariants(scene);
  if (violations.length > 0) {
    throw new Error(
      `Monge geometric/epistemic invariant violation:\n${violations.map((v) => ` - [${v.code}] ${v.message}`).join('\n')}`
    );
  }

  const rounds = fixture.rounds ?? [];
  const signSet = new Set<string>();

  const services: MongeServiceProjection[] = [];
  const serviceById = new Map<string, MongeServiceProjection>();

  for (const s of fixture.services) {
    assertValidSign(s.sign);
    const serviceSignForState = stateToSign(s.state);
    assertValidSign(serviceSignForState);
    signSet.add(s.sign);
    signSet.add(serviceSignForState);

    let publishedReason: string | null = s.reason?.trim() ? s.reason.trim() : null;
    if (s.state === 'unknown') {
      const cell = asOpaqueCell({
        state: 'unknown',
        display: s.display ?? null,
        reason: s.reason ?? null,
        proof_ref: s.proof_ref
      });
      if (cell.reason && DIGIT_RE.test(cell.reason)) {
        throw new Error(`Unknown mark "${s.id}" reason must not contain digits: ${s.proof_ref}`);
      }
      publishedReason = cell.reason;
    } else if (s.state === 'absent') {
      asOpaqueCell({
        state: 'absent',
        display: null,
        proof_ref: s.proof_ref,
        completeness_witness_ref: s.completeness_witness_ref ?? null
      });
    } else if (s.state === 'invalid') {
      const cell = asOpaqueCell({
        state: 'invalid',
        display: s.display ?? null,
        reason: s.reason ?? null,
        proof_ref: s.proof_ref
      });
      publishedReason = cell.reason;
    }

    const p1 = projectOrtho(s.x, s.y, 0, trig);
    const hinge2 = projectOrtho(s.x, PLANE_HALF_Y, 0, trig);
    const top2 = plane2Point(s.x, WALL_DEPTH, trig);
    const hinge3 = projectOrtho(PLANE_HALF_X, s.y, 0, trig);
    const top3 = plane3Point(s.y, WALL_DEPTH, trig);

    const roundMarks: MongeRoundMark[] = [];
    const states = s.round_states ?? [];
    const roundProofs = s.round_proof_refs ?? [];
    for (let i = 0; i < rounds.length; i++) {
      const st = states[i];
      if (!st) continue;
      const roundSign = stateToSign(st);
      assertValidSign(roundSign);
      signSet.add(roundSign);
      const rawRoundProof = roundProofs[i];
      const ownProof =
        typeof rawRoundProof === 'string' && rawRoundProof.trim().length > 0 ? rawRoundProof.trim() : null;
      const h = ((i + 1) / (rounds.length + 1)) * WALL_DEPTH;
      roundMarks.push({
        roundId: rounds[i]!,
        state: st,
        sign: roundSign,
        proofRef: ownProof,
        plane2: plane2Point(s.x, h, trig),
        plane3: plane3Point(s.y, h, trig)
      });
    }

    let unknownCurtain: readonly [Point2D, Point2D, Point2D, Point2D] | undefined;
    if (s.state === 'unknown') {
      // Hatched uncertainty curtain rising off z = 0 (never collapsed to z = 0).
      const halfSpan = 0.16;
      const b0 = projectOrtho(s.x - halfSpan, s.y, 0.08, trig);
      const b1 = projectOrtho(s.x + halfSpan, s.y, 0.08, trig);
      const t1 = projectOrtho(s.x + halfSpan, s.y, CURTAIN_HEIGHT, trig);
      const t0 = projectOrtho(s.x - halfSpan, s.y, CURTAIN_HEIGHT, trig);
      unknownCurtain = [b0, b1, t1, t0];
    }

    const proj: MongeServiceProjection = {
      id: s.id,
      label: s.label,
      short: s.short ?? s.id,
      sign: s.sign,
      state: s.state,
      reason: publishedReason,
      proofRef: s.proof_ref,
      completenessWitnessRef: s.completeness_witness_ref ?? null,
      mongeCoords: { x: s.x, y: s.y },
      plane1: p1,
      rayToPlane2: [p1, hinge2, top2],
      rayToPlane3: [p1, hinge3, top3],
      ...(unknownCurtain ? { unknownCurtain } : {}),
      rounds: roundMarks
    };
    services.push(proj);
    serviceById.set(s.id, proj);
  }

  const driftArcs: MongeDriftProjection[] = fixture.drift_arcs.map((arc) => {
    const src = serviceById.get(arc.from);
    const dst = serviceById.get(arc.to);
    if (!src || !dst) {
      throw new Error(`Drift arc "${arc.id}" references unknown endpoint(s): ${arc.from} -> ${arc.to}`);
    }
    signSet.add('drift');

    const p0 = src.plane1;
    const p1 = dst.plane1;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * DRIFT_OFFSET;
    const ny = (dx / len) * DRIFT_OFFSET;

    const s0: Point2D = { x: p0.x + nx, y: p0.y + ny };
    const s1: Point2D = { x: p1.x + nx, y: p1.y + ny };
    const o0: Point2D = { x: p0.x - nx, y: p0.y - ny };
    const o1: Point2D = { x: p1.x - nx, y: p1.y - ny };
    const mid: Point2D = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };

    const ownArcProof =
      typeof arc.proof_ref === 'string' && arc.proof_ref.trim().length > 0 ? arc.proof_ref.trim() : null;
    return {
      id: arc.id,
      from: arc.from,
      to: arc.to,
      label: arc.label,
      proofRef: ownArcProof,
      statedProofRef: arc.stated_proof_ref,
      observedProofRef: arc.observed_proof_ref,
      statedPath: `M ${fmtPt(s0)} L ${fmtPt(s1)}`,
      observedPath: `M ${fmtPt(o0)} L ${fmtPt(o1)}`,
      midpoint: mid
    };
  });

  const plane1Pts: readonly Point2D[] = [
    projectOrtho(-PLANE_HALF_X, -PLANE_HALF_Y, 0, trig),
    projectOrtho(PLANE_HALF_X, -PLANE_HALF_Y, 0, trig),
    projectOrtho(PLANE_HALF_X, PLANE_HALF_Y, 0, trig),
    projectOrtho(-PLANE_HALF_X, PLANE_HALF_Y, 0, trig)
  ];
  const plane2Pts: readonly Point2D[] = [
    projectOrtho(-PLANE_HALF_X, PLANE_HALF_Y, 0, trig),
    projectOrtho(PLANE_HALF_X, PLANE_HALF_Y, 0, trig),
    plane2Point(PLANE_HALF_X, WALL_DEPTH, trig),
    plane2Point(-PLANE_HALF_X, WALL_DEPTH, trig)
  ];
  const plane3Pts: readonly Point2D[] = [
    projectOrtho(PLANE_HALF_X, -PLANE_HALF_Y, 0, trig),
    projectOrtho(PLANE_HALF_X, PLANE_HALF_Y, 0, trig),
    plane3Point(PLANE_HALF_Y, WALL_DEPTH, trig),
    plane3Point(-PLANE_HALF_Y, WALL_DEPTH, trig)
  ];

  const planes: readonly MongePlaneQuad[] = [
    {
      id: 'plane-1',
      label: 'Plane I (X × Y)',
      points: quadToPoints(plane1Pts),
      labelPos: projectOrtho(-PLANE_HALF_X + 0.15, -PLANE_HALF_Y + 0.15, 0, trig)
    },
    {
      id: 'plane-2',
      label: 'Plane II (X × Strata)',
      points: quadToPoints(plane2Pts),
      labelPos: plane2Point(-PLANE_HALF_X + 0.15, WALL_DEPTH - 0.18, trig)
    },
    {
      id: 'plane-3',
      label: 'Plane III (Y × Strata)',
      points: quadToPoints(plane3Pts),
      labelPos: plane3Point(-PLANE_HALF_Y + 0.15, WALL_DEPTH - 0.18, trig)
    }
  ];

  return {
    scene,
    foldAngleDeg,
    projection,
    rounds,
    planes,
    services,
    driftArcs,
    usedSigns: [...signSet].sort(),
    viewBox: { minX: 40, minY: 0, width: 720, height: 520 }
  };
}
