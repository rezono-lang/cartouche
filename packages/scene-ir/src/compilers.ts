/**
 * Zero-Compute Pure Compilers from Frozen Rezono Fixtures -> CartoucheScene v2 IR.
 * Notice: ZERO arithmetic or business derivation on display values.
 */

import { asOpaqueCell, DeltaStore, renderOpaqueText } from '../../reader-core/src/index.ts';
import type { ManifestMeta } from '../../reader-core/src/index.ts';
import { CARTOUCHE_SCENE_SCHEMA_VERSION } from './types.ts';
import type { CartoucheScene, SceneDriftEdge, SceneNodeMark, Unknown3DManifold } from './types.ts';
import { assertXDDiscipline } from './xd-guard.ts';

export function compileFlowSplitScene(fixture: {
  manifest: ManifestMeta;
  horizon: { complete: boolean; reason: string | null };
  nodes: readonly {
    id: string; label: string; zone: string; sign: 'decision' | 'design' | 'observation' | 'derived';
    state: 'valid' | 'changed' | 'violated' | 'absent' | 'unknown';
    reason?: string; proof_ref: string; completeness_witness_ref?: string;
  }[];
  edges: readonly {
    id: string; from: string; to: string; kind: string; label?: string;
    stated_proof_ref?: string; observed_proof_ref?: string;
  }[];
}): CartoucheScene {
  const store = new DeltaStore(fixture.manifest);
  const nodes: SceneNodeMark[] = fixture.nodes.map((n, idx) => ({
    id: n.id,
    label: n.label,
    sign: n.sign,
    state: n.state,
    proofRef: n.proof_ref,
    completenessWitnessRef: n.completeness_witness_ref ?? null,
    box: { id: n.id, x: (idx % 3) * 200, y: Math.floor(idx / 3) * 110, w: 160, h: 72 }
  }));

  const driftEdges: SceneDriftEdge[] = fixture.edges
    .filter((e) => e.kind === 'drift')
    .map((e) => ({
      id: e.id,
      from: e.from,
      to: e.to,
      label: e.label ?? 'DRIFT',
      statedProofRef: e.stated_proof_ref ?? '',
      observedProofRef: e.observed_proof_ref ?? ''
    }));

  const usedSigns = [...new Set([...nodes.map((n) => n.sign), ...nodes.map((n) => n.state), ...(driftEdges.length ? ['drift'] : [])])].sort();

  const scene: CartoucheScene = {
    schemaVersion: CARTOUCHE_SCENE_SCHEMA_VERSION,
    archetype: 'flow-split',
    projection: '2d',
    axes: [
      { axis: 'x', dim: 'D1', kind: 'nominal', label: 'Zone' },
      { axis: 'y', dim: 'D1', kind: 'nominal', label: 'Entity' }
    ],
    horizon: fixture.horizon,
    nodes,
    driftEdges,
    unknownManifolds: [],
    usedSigns,
    tableTwin: {
      headers: ['Entity', 'Zone', 'Sign', 'State', 'Proof'],
      rows: fixture.nodes.map((n) => [n.label, n.zone, n.sign, n.state, n.proof_ref])
    },
    seal: store.seal()
  };

  assertXDDiscipline(scene);
  return scene;
}

export function compileSubsidyReliefScene(fixture: {
  manifest: ManifestMeta;
  subjects: readonly {
    id: string; state: 'valid' | 'unknown';
    amount_cell: { state: 'known' | 'unknown'; display?: string | null; reason?: string; proof_ref: string };
    citation: string;
  }[];
  sweep_2d: {
    projection: 'orthographic' | 'perspective';
    x_axis: { dim: 'D7'; kind: 'metric'; label: string };
    y_axis: { dim: 'D7'; kind: 'metric'; label: string };
    z_axis: { dim: 'D7'; kind: 'metric'; label: string };
    unknown_manifolds: readonly { subject_id: string; kind: 'uncertainty_curtain'; reason: string; proof_ref: string }[];
  };
}): CartoucheScene {
  const store = new DeltaStore(fixture.manifest);
  const nodes: SceneNodeMark[] = fixture.subjects.map((sub, idx) => {
    const cell = asOpaqueCell(sub.amount_cell);
    return {
      id: sub.id,
      label: `${sub.id} · ${renderOpaqueText(cell)}`,
      sign: 'derived',
      state: sub.state,
      proofRef: cell.proofRef,
      cell,
      box: { id: sub.id, x: idx * 240, y: 0, w: 200, h: 90 }
    };
  });

  const unknownManifolds: Unknown3DManifold[] = fixture.sweep_2d.unknown_manifolds.map((m) => ({
    subjectId: m.subject_id,
    kind: m.kind,
    reason: m.reason,
    proofRef: m.proof_ref,
    zFloorZeroForbidden: true
  }));

  const scene: CartoucheScene = {
    schemaVersion: CARTOUCHE_SCENE_SCHEMA_VERSION,
    archetype: 'relief-3d',
    projection: fixture.sweep_2d.projection,
    axes: [
      { axis: 'x', dim: fixture.sweep_2d.x_axis.dim, kind: fixture.sweep_2d.x_axis.kind, label: fixture.sweep_2d.x_axis.label },
      { axis: 'y', dim: fixture.sweep_2d.y_axis.dim, kind: fixture.sweep_2d.y_axis.kind, label: fixture.sweep_2d.y_axis.label },
      { axis: 'z', dim: fixture.sweep_2d.z_axis.dim, kind: fixture.sweep_2d.z_axis.kind, label: fixture.sweep_2d.z_axis.label }
    ],
    horizon: { complete: true, reason: null },
    nodes,
    driftEdges: [],
    unknownManifolds,
    usedSigns: ['legislator', 'derived', 'valid', 'unknown'],
    tableTwin: {
      headers: ['Subject', 'Amount', 'State', 'Citation'],
      rows: nodes.map((n, i) => [n.id, n.cell ? renderOpaqueText(n.cell) : '', n.state, fixture.subjects[i]!.citation])
    },
    seal: store.seal()
  };

  assertXDDiscipline(scene);
  return scene;
}

export function compileMongeScene(fixture: {
  manifest: ManifestMeta;
  projection: 'orthographic';
  services: readonly {
    id: string; label: string; sign: 'decision' | 'design';
    x: number; y: number; state: 'valid' | 'violated' | 'absent' | 'unknown';
    proof_ref: string; completeness_witness_ref?: string;
  }[];
  drift_arcs: readonly { id: string; from: string; to: string; label: string; stated_proof_ref: string; observed_proof_ref: string }[];
}): CartoucheScene {
  const store = new DeltaStore(fixture.manifest);
  const nodes: SceneNodeMark[] = fixture.services.map((s, idx) => ({
    id: s.id,
    label: s.label,
    sign: s.sign,
    state: s.state,
    proofRef: s.proof_ref,
    completenessWitnessRef: s.completeness_witness_ref ?? null,
    box: { id: s.id, x: idx * 180, y: 0, w: 140, h: 64 },
    mongeCoords: { x: s.x, y: s.y }
  }));

  const driftEdges: SceneDriftEdge[] = fixture.drift_arcs.map((a) => ({
    id: a.id,
    from: a.from,
    to: a.to,
    label: a.label,
    statedProofRef: a.stated_proof_ref,
    observedProofRef: a.observed_proof_ref
  }));

  const scene: CartoucheScene = {
    schemaVersion: CARTOUCHE_SCENE_SCHEMA_VERSION,
    archetype: 'monge-fold',
    projection: fixture.projection,
    axes: [
      { axis: 'x', dim: 'D1', kind: 'nominal', label: 'Topology X' },
      { axis: 'y', dim: 'D1', kind: 'nominal', label: 'Topology Y' },
      { axis: 'z', dim: 'D3', kind: 'stratified', label: 'Norm || Observed Strata' }
    ],
    horizon: { complete: true, reason: null },
    nodes,
    driftEdges,
    unknownManifolds: [],
    usedSigns: ['decision', 'design', 'drift', 'absent', 'unknown'],
    tableTwin: {
      headers: ['Service', 'X', 'Y', 'State', 'Proof'],
      rows: fixture.services.map((s) => [s.label, String(s.x), String(s.y), s.state, s.proof_ref])
    },
    seal: store.seal()
  };

  assertXDDiscipline(scene);
  return scene;
}
