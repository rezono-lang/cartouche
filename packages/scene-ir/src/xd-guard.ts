/**
 * Decision 0002 & 0007: xD-Discipline Guard (frozen contract cartouche.scene-ir/2).
 * Rejects dishonest or perspective-distorted projections at compile time before a pixel renders.
 */

import { CARTOUCHE_SCENE_SCHEMA_VERSION } from './types.ts';
import type { CartoucheScene } from './types.ts';

export const XD_LAW_CODES = Object.freeze([
  'XD_UNKNOWN_SCHEMA_VERSION',
  'XD_NO_PERSPECTIVE',
  'XD_NOMINAL_Z_FORBIDDEN',
  'XD_MISSING_TABLE_TWIN',
  'XD_UNKNOWN_AT_ZERO_FORBIDDEN',
  'XD_MONGE_Z_NOT_STRATIFIED',
  'XD_BITEMPORAL_REQUIRES_BITEMPORAL_AXES'
] as const);

export type XDLawCode = (typeof XD_LAW_CODES)[number];

export interface DisciplineViolation {
  readonly code: XDLawCode;
  readonly message: string;
}

export function validateXDDiscipline(scene: CartoucheScene): readonly DisciplineViolation[] {
  const violations: DisciplineViolation[] = [];

  // Law 0: Frozen CartoucheScene v2 schemaVersion is mandatory.
  if (scene.schemaVersion !== CARTOUCHE_SCENE_SCHEMA_VERSION) {
    violations.push({
      code: 'XD_UNKNOWN_SCHEMA_VERSION',
      message: `Scene schemaVersion must be "${CARTOUCHE_SCENE_SCHEMA_VERSION}", received "${String(scene.schemaVersion)}".`
    });
  }

  // Law 1: Perspective 3D is strictly forbidden in Cartouche.
  if (scene.projection === 'perspective') {
    violations.push({
      code: 'XD_NO_PERSPECTIVE',
      message: `Sheet "${scene.archetype}" requested perspective 3D; only 2D or orthographic 3D is permitted.`
    });
  }

  // Law 2: Nominal dimensions (D1 entity IDs, D8 roles) may NEVER bind to continuous Z height.
  const zAxis = scene.axes.find((a) => a.axis === 'z');
  if (zAxis && (zAxis.kind === 'nominal' || zAxis.dim === 'D1' || zAxis.dim === 'D8')) {
    violations.push({
      code: 'XD_NOMINAL_Z_FORBIDDEN',
      message: `Nominal dimension ${zAxis.dim} ("${zAxis.label}") cannot map to continuous Z height.`
    });
  }

  // Law 3: Every 3D scene MUST provide an accessible non-empty Table Twin.
  if (scene.projection === 'orthographic' && scene.tableTwin.headers.length === 0) {
    violations.push({
      code: 'XD_MISSING_TABLE_TWIN',
      message: `Orthographic 3D sheet "${scene.archetype}" must include a synchronized HTML Table Twin.`
    });
  }

  // Law 4: In 3D relief scenes, unknown subjects cannot be dropped to z = 0; they require an uncertainty manifold.
  if (scene.archetype === 'relief-3d') {
    const unknownNodes = scene.nodes.filter((n) => n.state === 'unknown');
    for (const un of unknownNodes) {
      const hasCurtain = scene.unknownManifolds.some((m) => m.subjectId === un.id);
      if (!hasCurtain) {
        violations.push({
          code: 'XD_UNKNOWN_AT_ZERO_FORBIDDEN',
          message: `Unknown subject "${un.id}" in 3D relief lacks a hatched uncertainty_curtain manifold (unknown must never sit at z=0).`
        });
      }
    }
  }

  // Law 5: Monge folding sheets must stratify the Z axis (norm || observed strata).
  if (scene.archetype === 'monge-fold' && (!zAxis || zAxis.kind !== 'stratified')) {
    violations.push({
      code: 'XD_MONGE_Z_NOT_STRATIFIED',
      message: `Monge folding sheet "${scene.archetype}" requires a Z axis with kind === "stratified".`
    });
  }

  // Law 6: Bitemporal staircase sheets require at least two bitemporal axes (Valid Time x Knowledge Time).
  if (scene.archetype === 'bitemporal-stair') {
    const btAxes = scene.axes.filter((a) => a.kind === 'bitemporal');
    if (btAxes.length < 2) {
      violations.push({
        code: 'XD_BITEMPORAL_REQUIRES_BITEMPORAL_AXES',
        message: `Bitemporal staircase sheet requires at least 2 bitemporal axes (Valid Time x Knowledge Time), found ${btAxes.length}.`
      });
    }
  }

  return Object.freeze(violations);
}

export function assertXDDiscipline(scene: CartoucheScene): void {
  const violations = validateXDDiscipline(scene);
  if (violations.length > 0) {
    throw new Error(`xD-Discipline Guard rejected scene:\n${violations.map((v) => ` - [${v.code}] ${v.message}`).join('\n')}`);
  }
}
