/**
 * Decision 0002: xD-Discipline Guard.
 * Rejects dishonest or perspective-distorted projections at compile time before a pixel renders.
 */

import type { CartoucheScene } from './types.ts';

export interface DisciplineViolation {
  readonly code: string;
  readonly message: string;
}

export function validateXDDiscipline(scene: CartoucheScene): readonly DisciplineViolation[] {
  const violations: DisciplineViolation[] = [];

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

  return Object.freeze(violations);
}

export function assertXDDiscipline(scene: CartoucheScene): void {
  const violations = validateXDDiscipline(scene);
  if (violations.length > 0) {
    throw new Error(`xD-Discipline Guard rejected scene:\n${violations.map((v) => ` - [${v.code}] ${v.message}`).join('\n')}`);
  }
}
