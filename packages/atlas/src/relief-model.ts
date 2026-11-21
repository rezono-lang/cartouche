/**
 * Sheet 01: 3D Swisstopo Statutory Relief (Decision 0002 & 0003).
 * Pure headless, zero-compute model, Threlte v8 / Three.js orthographic scene descriptor,
 * and deterministic orthographic axonometric + 2D profile SVG exporters.
 *
 * Guarantees:
 *  - Strictly orthographic 3D (perspective is rejected by assertXDDiscipline and buildReliefModel).
 *  - Zero client compute: every display token is validated via asOpaqueCell and passed verbatim.
 *  - Unknown subjects NEVER sit at z = 0; they project as hatched vertical uncertainty curtains.
 *  - 100% testable without WebGL; carries synchronized HTML Table Twin data and exact drawn-sign legend.
 */

import {
  DATA_MARKS,
  PALETTES,
  SIGNS,
  asOpaqueCell,
  renderOpaqueText
} from '../../reader-core/src/index.ts';
import type {
  ManifestMeta,
  OpaqueDisplayCell,
  PaletteName,
  PaletteTokens,
  RawCellInput,
  SignSpec
} from '../../reader-core/src/index.ts';
import { compileSubsidyReliefScene } from '../../scene-ir/src/compilers.ts';
import { checkGeometricInvariants } from '../../scene-ir/src/geometry-invariants.ts';
import { assertXDDiscipline } from '../../scene-ir/src/xd-guard.ts';
import type { CartoucheScene } from '../../scene-ir/src/types.ts';

export type ReliefProjection = 'orthographic' | '2d';

export interface ReliefAxisInput {
  readonly dim: 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7' | 'D8';
  readonly kind: 'metric' | 'ordinal' | 'bitemporal' | 'stratified' | 'nominal';
  readonly label: string;
  readonly stops?: readonly string[];
  readonly unit?: string;
}

export interface ReliefGridCellInput {
  readonly ix: number;
  readonly iy: number;
  readonly z_norm: number;
  readonly cell: RawCellInput;
}

export interface ReliefUnknownManifoldInput {
  readonly subject_id: string;
  readonly kind: 'uncertainty_curtain' | 'uncertainty_prism';
  readonly fixed_axis: 'x' | 'y';
  readonly fixed_index: number;
  readonly span_axis: 'x' | 'y';
  readonly reason: string;
  readonly proof_ref: string;
}

export interface ReliefCliffDistanceInput {
  readonly subject_id: string;
  readonly display: string;
  readonly proof_ref: string;
}

export interface ReliefSubjectInput {
  readonly id: string;
  readonly state: 'valid' | 'changed' | 'violated' | 'unknown' | 'absent';
  readonly amount_cell: RawCellInput;
  readonly income_cell?: RawCellInput;
  readonly assets_cell?: RawCellInput;
  readonly cliff_distance_display?: string;
  readonly citation: string;
}

export interface ReliefFixtureInput {
  readonly fixture_id?: string;
  readonly manifest: ManifestMeta;
  readonly subjects: readonly ReliefSubjectInput[];
  readonly sweep_2d: {
    readonly projection: 'orthographic' | 'perspective';
    readonly x_axis: ReliefAxisInput & { readonly stops: readonly string[] };
    readonly y_axis: ReliefAxisInput & { readonly stops: readonly string[] };
    readonly z_axis: ReliefAxisInput & { readonly unit: string };
    readonly cells: readonly ReliefGridCellInput[];
    readonly cliff_distances?: readonly ReliefCliffDistanceInput[];
    readonly unknown_manifolds: readonly ReliefUnknownManifoldInput[];
  };
}

export interface ReliefValidatedSubject {
  readonly id: string;
  readonly state: ReliefSubjectInput['state'];
  readonly sign: 'derived';
  readonly amountCell: OpaqueDisplayCell;
  readonly incomeCell: OpaqueDisplayCell | null;
  readonly assetsCell: OpaqueDisplayCell | null;
  readonly cliffDistanceDisplay: string | null;
  readonly citation: string;
  readonly hasUncertaintyCurtain: boolean;
}

export interface ReliefValidatedGridCell {
  readonly ix: number;
  readonly iy: number;
  readonly xStop: string;
  readonly yStop: string;
  readonly zNorm: number;
  readonly opaque: OpaqueDisplayCell;
  readonly screenX: number;
  readonly screenY: number;
  readonly topY: number;
}

export interface ReliefCurtainGeometry {
  readonly subjectId: string;
  readonly kind: 'uncertainty_curtain' | 'uncertainty_prism';
  readonly fixedAxis: 'x' | 'y';
  readonly fixedIndex: number;
  readonly spanAxis: 'x' | 'y';
  readonly reason: string;
  readonly proofRef: string;
  readonly zMin: number;
  readonly zMax: number;
  readonly zFloorZeroForbidden: true;
  readonly spanStopLabels: readonly string[];
  readonly fixedStopLabel: string;
}

export interface ReliefCliffMarker {
  readonly subjectId: string;
  readonly display: string;
  readonly proofRef: string;
  readonly citation: string | null;
}

export interface OrthographicCameraSpec {
  readonly cameraType: 'OrthographicCamera';
  readonly projection: 'orthographic';
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly zoom: number;
  readonly near: number;
  readonly far: number;
}

export interface ReliefThrelteSceneSpec {
  readonly camera: OrthographicCameraSpec;
  readonly gridSize: readonly [number, number];
  readonly terraces: readonly {
    readonly key: string;
    readonly position: readonly [number, number, number];
    readonly height: number;
    readonly proofRef: string;
    readonly state: string;
  }[];
  readonly curtains: readonly {
    readonly subjectId: string;
    readonly fixedAxis: 'x' | 'y';
    readonly fixedIndex: number;
    readonly zMin: number;
    readonly zMax: number;
    readonly proofRef: string;
    readonly reason: string;
  }[];
}

export interface ReliefLegendItem {
  readonly key: string;
  readonly glyph: string;
  readonly kind: SignSpec['kind'];
  readonly pattern: string;
  readonly token: keyof PaletteTokens;
}

export interface ReliefModel {
  readonly scene: CartoucheScene;
  readonly theme: PaletteName;
  readonly palette: PaletteTokens;
  readonly projection: ReliefProjection;
  readonly sliceYIndex: number;
  readonly xAxis: { readonly dim: string; readonly kind: string; readonly label: string; readonly stops: readonly string[] };
  readonly yAxis: { readonly dim: string; readonly kind: string; readonly label: string; readonly stops: readonly string[] };
  readonly zAxis: { readonly dim: string; readonly kind: string; readonly label: string; readonly unit: string };
  readonly subjects: readonly ReliefValidatedSubject[];
  readonly gridCells: readonly ReliefValidatedGridCell[];
  readonly profileCells: readonly ReliefValidatedGridCell[];
  readonly curtains: readonly ReliefCurtainGeometry[];
  readonly cliffMarkers: readonly ReliefCliffMarker[];
  readonly threlteScene: ReliefThrelteSceneSpec;
  readonly legendItems: readonly ReliefLegendItem[];
  readonly width: number;
  readonly height: number;
}

export interface ReliefBuildOptions {
  readonly theme?: PaletteName;
  readonly projection?: ReliefProjection;
  readonly sliceYIndex?: number;
}

const DIGIT_RE = /[0-9]/;
const SVG_W = 760;
const SVG_H = 440;
const ISO_ORIGIN_X = 360;
const ISO_ORIGIN_Y = 300;
const ISO_STEP_X = 72;
const ISO_STEP_Y = 36;
const ISO_Z_SCALE = 150;

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function resolveSignSpec(signName: string): SignSpec {
  if (!Object.prototype.hasOwnProperty.call(SIGNS, signName)) {
    throw new Error(`Unknown std-view sign: "${signName}".`);
  }
  const spec = SIGNS[signName];
  if (!spec) {
    throw new Error(`Unknown std-view sign: "${signName}".`);
  }
  return spec;
}

function projectIso(gx: number, gy: number, gz: number): { readonly px: number; readonly py: number } {
  const px = ISO_ORIGIN_X + (gx - gy) * ISO_STEP_X;
  const py = ISO_ORIGIN_Y + (gx + gy) * ISO_STEP_Y - gz * ISO_Z_SCALE;
  return { px, py };
}

function validateNonKnownReason(opaque: OpaqueDisplayCell): void {
  if (opaque.state === 'unknown') {
    if (!opaque.reason || opaque.reason.trim().length === 0) {
      throw new Error(`Unknown cell (${opaque.proofRef}) requires an explicit published reason.`);
    }
    if (DIGIT_RE.test(opaque.reason)) {
      throw new Error(`Unknown cell (${opaque.proofRef}) reason must contain zero ASCII digits.`);
    }
  }
}

export function buildReliefModel(
  fixture: ReliefFixtureInput,
  options: ReliefBuildOptions = {}
): ReliefModel {
  const theme: PaletteName =
    options.theme && Object.prototype.hasOwnProperty.call(PALETTES, options.theme)
      ? options.theme
      : 'swisstopo';
  const palette = PALETTES[theme];

  if (fixture.sweep_2d.projection !== 'orthographic') {
    throw new Error(
      `[XD_NO_PERSPECTIVE] Sheet "relief-3d" requires orthographic projection, received "${fixture.sweep_2d.projection}".`
    );
  }

  const validatedSubjectCells = fixture.subjects.map((sub) => {
    const amountCell = asOpaqueCell(sub.amount_cell);
    validateNonKnownReason(amountCell);
    const incomeCell = sub.income_cell ? asOpaqueCell(sub.income_cell) : null;
    if (incomeCell) validateNonKnownReason(incomeCell);
    const assetsCell = sub.assets_cell ? asOpaqueCell(sub.assets_cell) : null;
    if (assetsCell) validateNonKnownReason(assetsCell);
    return { sub, amountCell, incomeCell, assetsCell };
  });

  const compilerSubjects = validatedSubjectCells.map(({ sub, amountCell }) => {
    if (sub.state !== 'valid' && sub.state !== 'unknown') {
      throw new Error(
        `Unsupported relief subject state "${sub.state}" for "${sub.id}" (only "valid" and "unknown" are representable without state collapse).`
      );
    }
    if (amountCell.state !== 'known' && amountCell.state !== 'unknown') {
      throw new Error(
        `Unsupported relief amount_cell state "${amountCell.state}" for "${sub.id}" (only "known" and "unknown" are representable without state collapse).`
      );
    }
    return {
      id: sub.id,
      state: sub.state,
      amount_cell:
        amountCell.state === 'unknown'
          ? {
              state: 'unknown' as const,
              display: null,
              ...(amountCell.reason !== null ? { reason: amountCell.reason } : {}),
              proof_ref: amountCell.proofRef
            }
          : {
              state: 'known' as const,
              display: amountCell.display,
              proof_ref: amountCell.proofRef
            },
      citation: sub.citation
    };
  });

  const compilerManifolds = fixture.sweep_2d.unknown_manifolds.map((m) => ({
    subject_id: m.subject_id,
    kind: 'uncertainty_curtain' as const,
    reason: m.reason,
    proof_ref: m.proof_ref
  }));

  const scene = compileSubsidyReliefScene({
    manifest: fixture.manifest,
    subjects: compilerSubjects,
    sweep_2d: {
      projection: fixture.sweep_2d.projection,
      x_axis: {
        dim: fixture.sweep_2d.x_axis.dim as 'D7',
        kind: fixture.sweep_2d.x_axis.kind as 'metric',
        label: fixture.sweep_2d.x_axis.label
      },
      y_axis: {
        dim: fixture.sweep_2d.y_axis.dim as 'D7',
        kind: fixture.sweep_2d.y_axis.kind as 'metric',
        label: fixture.sweep_2d.y_axis.label
      },
      z_axis: {
        dim: fixture.sweep_2d.z_axis.dim as 'D7',
        kind: fixture.sweep_2d.z_axis.kind as 'metric',
        label: fixture.sweep_2d.z_axis.label
      },
      unknown_manifolds: compilerManifolds
    }
  });

  // Explicitly re-verify xD-Discipline and headless geometric invariants
  assertXDDiscipline(scene);
  const geomViolations = checkGeometricInvariants(scene);
  if (geomViolations.length > 0) {
    throw new Error(
      `Geometric invariant violation(s): ${geomViolations.map((v) => `[${v.code}] ${v.message}`).join('; ')}`
    );
  }

  const xStops = fixture.sweep_2d.x_axis.stops;
  const yStops = fixture.sweep_2d.y_axis.stops;

  const curtains: ReliefCurtainGeometry[] = fixture.sweep_2d.unknown_manifolds.map((m) => {
    if (!m.proof_ref || m.proof_ref.trim().length === 0) {
      throw new Error(`Uncertainty curtain for "${m.subject_id}" requires a non-empty proof_ref.`);
    }
    if (!m.reason || m.reason.trim().length === 0) {
      throw new Error(`Uncertainty curtain for "${m.subject_id}" requires an explicit published reason.`);
    }
    if (DIGIT_RE.test(m.reason)) {
      throw new Error(`Uncertainty curtain for "${m.subject_id}" reason must contain zero ASCII digits.`);
    }
    const fixedStops = m.fixed_axis === 'y' ? yStops : xStops;
    const spanStops = m.span_axis === 'x' ? xStops : yStops;
    const fixedStopLabel = fixedStops[m.fixed_index];
    if (fixedStopLabel === undefined) {
      throw new Error(`Uncertainty curtain fixed_index ${m.fixed_index} out of bounds for axis "${m.fixed_axis}".`);
    }
    return Object.freeze({
      subjectId: m.subject_id,
      kind: m.kind,
      fixedAxis: m.fixed_axis,
      fixedIndex: m.fixed_index,
      spanAxis: m.span_axis,
      reason: m.reason,
      proofRef: m.proof_ref,
      zMin: 0,
      zMax: 1,
      zFloorZeroForbidden: true as const,
      spanStopLabels: Object.freeze([...spanStops]),
      fixedStopLabel
    });
  });

  const curtainSubjects = new Set(curtains.map((c) => c.subjectId));

  const subjects: ReliefValidatedSubject[] = validatedSubjectCells.map(
    ({ sub, amountCell, incomeCell, assetsCell }) => {
      const hasUncertaintyCurtain = curtainSubjects.has(sub.id);
      if ((sub.state === 'unknown' || amountCell.state === 'unknown') && !hasUncertaintyCurtain) {
        throw new Error(
          `[XD_UNKNOWN_AT_ZERO_FORBIDDEN] Unknown subject "${sub.id}" requires a hatched uncertainty curtain manifold.`
        );
      }

      return Object.freeze({
        id: sub.id,
        state: sub.state,
        sign: 'derived' as const,
        amountCell,
        incomeCell,
        assetsCell,
        cliffDistanceDisplay: sub.cliff_distance_display ?? null,
        citation: sub.citation,
        hasUncertaintyCurtain
      });
    }
  );

  const gridCells: ReliefValidatedGridCell[] = fixture.sweep_2d.cells.map((entry) => {
    const opaque = asOpaqueCell(entry.cell);
    validateNonKnownReason(opaque);
    const xStop = xStops[entry.ix];
    const yStop = yStops[entry.iy];
    if (xStop === undefined || yStop === undefined) {
      throw new Error(`Grid cell (${entry.ix}, ${entry.iy}) exceeds published axis stops.`);
    }
    const basePt = projectIso(entry.ix, entry.iy, 0);
    const topPt = projectIso(entry.ix, entry.iy, entry.z_norm);
    return Object.freeze({
      ix: entry.ix,
      iy: entry.iy,
      xStop,
      yStop,
      zNorm: entry.z_norm,
      opaque,
      screenX: basePt.px,
      screenY: basePt.py,
      topY: topPt.py
    });
  });

  // Only emit SVG cliff markers for entries with a dedicated published proof_ref in sweep_2d.cliff_distances.
  // Subject cliff_distance_display without a dedicated cliff proof stays text in the subject's Table Twin row
  // so no SVG mark is ever drawn without a proof_ref or with a borrowed amount witness.
  const citationBySubject = new Map(subjects.map((s) => [s.id, s.citation] as const));
  const cliffMarkers: ReliefCliffMarker[] = [];
  for (const extra of fixture.sweep_2d.cliff_distances ?? []) {
    if (!extra.proof_ref || extra.proof_ref.trim().length === 0) {
      throw new Error(`Cliff distance entry for "${extra.subject_id}" requires a non-empty proof_ref.`);
    }
    cliffMarkers.push(
      Object.freeze({
        subjectId: extra.subject_id,
        display: extra.display,
        proofRef: extra.proof_ref,
        citation: citationBySubject.get(extra.subject_id) ?? null
      })
    );
  }

  const rawSlice = options.sliceYIndex ?? 1;
  const sliceYIndex = rawSlice >= 0 && rawSlice < yStops.length ? rawSlice : 0;
  const profileCells = gridCells.filter((c) => c.iy === sliceYIndex);

  const threlteScene: ReliefThrelteSceneSpec = Object.freeze({
    camera: Object.freeze({
      cameraType: 'OrthographicCamera' as const,
      projection: 'orthographic' as const,
      position: Object.freeze([8, 8, 8] as const),
      target: Object.freeze([1.5, 0.5, 1.5] as const),
      zoom: 64,
      near: 0.1,
      far: 100
    }),
    gridSize: Object.freeze([xStops.length, yStops.length] as const),
    terraces: Object.freeze(
      gridCells.map((c) =>
        Object.freeze({
          key: `cell:${c.ix}-${c.iy}`,
          position: Object.freeze([c.ix, c.zNorm, c.iy] as const),
          height: c.zNorm,
          proofRef: c.opaque.proofRef,
          state: c.opaque.state
        })
      )
    ),
    curtains: Object.freeze(
      curtains.map((c) =>
        Object.freeze({
          subjectId: c.subjectId,
          fixedAxis: c.fixedAxis,
          fixedIndex: c.fixedIndex,
          zMin: c.zMin,
          zMax: c.zMax,
          proofRef: c.proofRef,
          reason: c.reason
        })
      )
    )
  });

  // Collect exact drawn signs across SVG & Table Twin in deterministic order
  const drawnSignKeys: string[] = [];
  const seenSigns = new Set<string>();
  const addSign = (signName: string) => {
    resolveSignSpec(signName);
    if (!seenSigns.has(signName)) {
      seenSigns.add(signName);
      drawnSignKeys.push(signName);
    }
  };

  if (gridCells.length > 0 || subjects.length > 0) addSign('derived');
  if (cliffMarkers.length > 0) addSign('origin_vendor');
  for (const sub of subjects) {
    if (sub.amountCell.state !== 'known') addSign(sub.amountCell.state);
  }
  for (const cell of gridCells) {
    if (cell.opaque.state !== 'known') addSign(cell.opaque.state);
  }
  if (curtains.length > 0) addSign('unknown');

  const legendItems: ReliefLegendItem[] = drawnSignKeys.map((key) => {
    const spec = resolveSignSpec(key);
    return Object.freeze({
      key,
      glyph: spec.glyph,
      kind: spec.kind,
      pattern: spec.pattern,
      token: spec.token
    });
  });

  const projection: ReliefProjection = options.projection === '2d' ? '2d' : 'orthographic';

  return Object.freeze({
    scene,
    theme,
    palette,
    projection,
    sliceYIndex,
    xAxis: Object.freeze({
      dim: fixture.sweep_2d.x_axis.dim,
      kind: fixture.sweep_2d.x_axis.kind,
      label: fixture.sweep_2d.x_axis.label,
      stops: Object.freeze([...xStops])
    }),
    yAxis: Object.freeze({
      dim: fixture.sweep_2d.y_axis.dim,
      kind: fixture.sweep_2d.y_axis.kind,
      label: fixture.sweep_2d.y_axis.label,
      stops: Object.freeze([...yStops])
    }),
    zAxis: Object.freeze({
      dim: fixture.sweep_2d.z_axis.dim,
      kind: fixture.sweep_2d.z_axis.kind,
      label: fixture.sweep_2d.z_axis.label,
      unit: fixture.sweep_2d.z_axis.unit
    }),
    subjects: Object.freeze(subjects),
    gridCells: Object.freeze(gridCells),
    profileCells: Object.freeze(profileCells),
    curtains: Object.freeze(curtains),
    cliffMarkers: Object.freeze(cliffMarkers),
    threlteScene,
    legendItems: Object.freeze(legendItems),
    width: SVG_W,
    height: SVG_H
  });
}

function renderIsoPrismFaces(
  ix: number,
  iy: number,
  zNorm: number,
  palette: PaletteTokens
): string {
  const half = 0.34;
  const b0 = projectIso(ix - half, iy - half, 0);
  const b1 = projectIso(ix + half, iy - half, 0);
  const b2 = projectIso(ix + half, iy + half, 0);
  const b3 = projectIso(ix - half, iy + half, 0);

  const t0 = projectIso(ix - half, iy - half, zNorm);
  const t1 = projectIso(ix + half, iy - half, zNorm);
  const t2 = projectIso(ix + half, iy + half, zNorm);
  const t3 = projectIso(ix - half, iy + half, zNorm);

  const topPts = `${t0.px},${t0.py} ${t1.px},${t1.py} ${t2.px},${t2.py} ${t3.px},${t3.py}`;
  const leftPts = `${t3.px},${t3.py} ${t2.px},${t2.py} ${b2.px},${b2.py} ${b3.px},${b3.py}`;
  const rightPts = `${t1.px},${t1.py} ${t2.px},${t2.py} ${b2.px},${b2.py} ${b1.px},${b1.py}`;

  return [
    `<polygon points="${leftPts}" fill="${palette.limestone}" stroke="${palette.rule}" stroke-width="1" />`,
    `<polygon points="${rightPts}" fill="${palette.paperTint}" stroke="${palette.rule}" stroke-width="1" />`,
    `<polygon points="${topPts}" fill="${palette.paperElev}" stroke="${palette.ruleStrong}" stroke-width="1.2" />`
  ].join('');
}

export function renderReliefOrthographicSvg(
  model: ReliefModel,
  ariaLabel = 'Orthographic statutory relief terrain'
): string {
  const p = model.palette;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${model.width} ${model.height}" ` +
      `role="img" aria-label="${escapeXml(ariaLabel)}" ` +
      `${DATA_MARKS.sheet}="relief-3d" ${DATA_MARKS.projection}="orthographic">`,
    `<defs>`,
    `<pattern id="relief-unknown-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`,
    `<line x1="0" y1="0" x2="0" y2="8" stroke="${p.hatchStroke}" stroke-width="2" />`,
    `</pattern>`,
    `</defs>`,
    `<rect x="0" y="0" width="${model.width}" height="${model.height}" fill="${p.paper}" />`
  ];

  // Orthographic base grid & Swisstopo contour axis guides
  const xCount = model.xAxis.stops.length;
  const yCount = model.yAxis.stops.length;
  for (let gx = 0; gx < xCount; gx++) {
    const start = projectIso(gx, 0, 0);
    const end = projectIso(gx, yCount - 1, 0);
    parts.push(
      `<line x1="${start.px}" y1="${start.py}" x2="${end.px}" y2="${end.py}" stroke="${p.rule}" stroke-dasharray="3 3" />`,
      `<text x="${start.px}" y="${start.py + 22}" fill="${p.inkSoft}" font-size="11" text-anchor="middle">${escapeXml(model.xAxis.stops[gx]!)}</text>`
    );
  }
  for (let gy = 0; gy < yCount; gy++) {
    const start = projectIso(0, gy, 0);
    const end = projectIso(xCount - 1, gy, 0);
    parts.push(
      `<line x1="${start.px}" y1="${start.py}" x2="${end.px}" y2="${end.py}" stroke="${p.rule}" stroke-dasharray="3 3" />`,
      `<text x="${start.px - 28}" y="${start.py + 4}" fill="${p.inkSoft}" font-size="11" text-anchor="end">${escapeXml(model.yAxis.stops[gy]!)}</text>`
    );
  }

  // Axis titles
  parts.push(
    `<text x="16" y="24" fill="${p.ink}" font-size="12" font-weight="600">${escapeXml(model.zAxis.label)} (${escapeXml(model.zAxis.unit)}) — orthographic</text>`,
    `<text x="${model.width - 16}" y="${model.height - 14}" fill="${p.inkSoft}" font-size="11" text-anchor="end">${escapeXml(model.xAxis.label)} × ${escapeXml(model.yAxis.label)}</text>`
  );

  // Back-to-front painter order by structural grid coordinates (ix + iy)
  // @cartouche-geometry-sort
  const orderedCells = [...model.gridCells].sort((a, b) => a.ix + a.iy - (b.ix + b.iy) || a.ix - b.ix);

  for (const tile of orderedCells) {
    const labelText = renderOpaqueText(tile.opaque);
    const labelY = tile.topY - 8;
    parts.push(
      `<g ${DATA_MARKS.key}="cell:${tile.ix}-${tile.iy}" ${DATA_MARKS.sign}="derived" ` +
        `${DATA_MARKS.state}="${escapeXml(tile.opaque.state)}" ${DATA_MARKS.proof_ref}="${escapeXml(tile.opaque.proofRef)}">`,
      renderIsoPrismFaces(tile.ix, tile.iy, tile.zNorm, p),
      `<text x="${tile.screenX}" y="${labelY}" fill="${p.ink}" font-size="11" text-anchor="middle">${escapeXml(labelText)}</text>`,
      `</g>`
    );
  }

  // Hatched vertical uncertainty curtains (z ∈ [0, 1], NEVER collapsed to z = 0)
  const unknownGlyph = resolveSignSpec('unknown').glyph;
  for (const curtain of model.curtains) {
    const spanMax = (curtain.spanAxis === 'x' ? xCount : yCount) - 1;
    const startBase =
      curtain.fixedAxis === 'y'
        ? projectIso(0, curtain.fixedIndex, curtain.zMin)
        : projectIso(curtain.fixedIndex, 0, curtain.zMin);
    const endBase =
      curtain.fixedAxis === 'y'
        ? projectIso(spanMax, curtain.fixedIndex, curtain.zMin)
        : projectIso(curtain.fixedIndex, spanMax, curtain.zMin);
    const endTop =
      curtain.fixedAxis === 'y'
        ? projectIso(spanMax, curtain.fixedIndex, curtain.zMax)
        : projectIso(curtain.fixedIndex, spanMax, curtain.zMax);
    const startTop =
      curtain.fixedAxis === 'y'
        ? projectIso(0, curtain.fixedIndex, curtain.zMax)
        : projectIso(curtain.fixedIndex, 0, curtain.zMax);

    const curtainPoly = `${startBase.px},${startBase.py} ${endBase.px},${endBase.py} ${endTop.px},${endTop.py} ${startTop.px},${startTop.py}`;
    const labelX = (startTop.px + endTop.px) / 2;
    const labelY = (startTop.py + endTop.py) / 2 - 8;

    parts.push(
      `<g ${DATA_MARKS.part}="curtain" ${DATA_MARKS.key}="curtain:${escapeXml(curtain.subjectId)}" ` +
        `${DATA_MARKS.sign}="unknown" ${DATA_MARKS.state}="unknown" ` +
        `${DATA_MARKS.reason}="${escapeXml(curtain.reason)}" ${DATA_MARKS.proof_ref}="${escapeXml(curtain.proofRef)}">`,
      `<polygon points="${curtainPoly}" fill="url(#relief-unknown-hatch)" stroke="${p.hatchStroke}" stroke-width="1.5" stroke-dasharray="5 3" fill-opacity="0.72" />`,
      `<text x="${labelX}" y="${labelY}" fill="${p.ink}" font-size="11" text-anchor="middle">${escapeXml(`${unknownGlyph} unknown · ${curtain.reason}`)}</text>`,
      `</g>`
    );
  }

  // Cliff distance markers (every marker has a dedicated published proof_ref)
  const legGlyph = resolveSignSpec('origin_vendor').glyph;
  for (let idx = 0; idx < model.cliffMarkers.length; idx++) {
    const marker = model.cliffMarkers[idx]!;
    const my = 48 + idx * 24;
    parts.push(
      `<g ${DATA_MARKS.key}="cliff:${escapeXml(marker.subjectId)}" ${DATA_MARKS.sign}="origin_vendor" ` +
        `${DATA_MARKS.proof_ref}="${escapeXml(marker.proofRef)}">`,
      `<rect x="16" y="${my - 14}" width="260" height="20" rx="3" fill="${p.paperElev}" stroke="${p.proof}" stroke-width="1" />`,
      `<text x="24" y="${my}" fill="${p.proof}" font-size="11">${escapeXml(`${legGlyph} ${marker.subjectId}: ${marker.display}`)}</text>`,
      `</g>`
    );
  }

  parts.push('</svg>');
  return parts.join('');
}

export function renderRelief2DProfileSvg(
  model: ReliefModel,
  ariaLabel = '2D profile fallback of statutory relief'
): string {
  const p = model.palette;
  const padLeft = 72;
  const padRight = 36;
  const padTop = 52;
  const padBottom = 56;
  const plotW = model.width - padLeft - padRight;
  const plotH = model.height - padTop - padBottom;
  const xCount = model.xAxis.stops.length;
  const sliceLabel = model.yAxis.stops[model.sliceYIndex] ?? '';

  const xPos = (ix: number): number =>
    xCount <= 1 ? padLeft + plotW / 2 : padLeft + (ix / (xCount - 1)) * plotW;
  const yPos = (zNorm: number): number => padTop + (1 - zNorm) * plotH;

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${model.width} ${model.height}" ` +
      `role="img" aria-label="${escapeXml(ariaLabel)}" ` +
      `${DATA_MARKS.sheet}="relief-3d" ${DATA_MARKS.projection}="2d">`,
    `<defs>`,
    `<pattern id="relief-unknown-hatch-2d" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`,
    `<line x1="0" y1="0" x2="0" y2="8" stroke="${p.hatchStroke}" stroke-width="2" />`,
    `</pattern>`,
    `</defs>`,
    `<rect x="0" y="0" width="${model.width}" height="${model.height}" fill="${p.paper}" />`,
    `<text x="16" y="24" fill="${p.ink}" font-size="12" font-weight="600">${escapeXml(model.zAxis.label)} (${escapeXml(model.zAxis.unit)}) — 2D profile (${escapeXml(model.yAxis.label)} = ${escapeXml(sliceLabel)})</text>`,
    `<line x1="${padLeft}" y1="${padTop + plotH}" x2="${padLeft + plotW}" y2="${padTop + plotH}" stroke="${p.ruleStrong}" />`,
    `<line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + plotH}" stroke="${p.ruleStrong}" />`
  ];

  // X-axis stop ticks
  for (let gx = 0; gx < xCount; gx++) {
    const cx = xPos(gx);
    parts.push(
      `<line x1="${cx}" y1="${padTop + plotH}" x2="${cx}" y2="${padTop + plotH + 6}" stroke="${p.ruleStrong}" />`,
      `<text x="${cx}" y="${padTop + plotH + 22}" fill="${p.inkSoft}" font-size="11" text-anchor="middle">${escapeXml(model.xAxis.stops[gx]!)}</text>`
    );
  }

  // Hatched unknown band in 2D profile (never drawn as y = 0!)
  const unknownGlyph = resolveSignSpec('unknown').glyph;
  for (const curtain of model.curtains) {
    parts.push(
      `<g ${DATA_MARKS.part}="curtain" ${DATA_MARKS.key}="curtain:${escapeXml(curtain.subjectId)}" ` +
        `${DATA_MARKS.sign}="unknown" ${DATA_MARKS.state}="unknown" ` +
        `${DATA_MARKS.reason}="${escapeXml(curtain.reason)}" ${DATA_MARKS.proof_ref}="${escapeXml(curtain.proofRef)}">`,
      `<rect x="${padLeft}" y="${padTop}" width="${plotW}" height="${plotH}" fill="url(#relief-unknown-hatch-2d)" stroke="${p.hatchStroke}" stroke-dasharray="5 3" fill-opacity="0.35" />`,
      `<text x="${padLeft + plotW / 2}" y="${padTop + 18}" fill="${p.ink}" font-size="11" text-anchor="middle">${escapeXml(`${unknownGlyph} unknown · ${curtain.reason}`)}</text>`,
      `</g>`
    );
  }

  // Profile polyline + step nodes
  // @cartouche-geometry-sort
  const sortedProfile = [...model.profileCells].sort((a, b) => a.ix - b.ix);
  if (sortedProfile.length >= 2) {
    const polyPoints = sortedProfile.map((tile) => `${xPos(tile.ix)},${yPos(tile.zNorm)}`).join(' ');
    parts.push(
      `<polyline points="${polyPoints}" fill="none" stroke="${p.proof}" stroke-width="2" />`
    );
  }
  for (const tile of sortedProfile) {
    const cx = xPos(tile.ix);
    const cy = yPos(tile.zNorm);
    const labelText = renderOpaqueText(tile.opaque);
    parts.push(
      `<g ${DATA_MARKS.key}="cell:${tile.ix}-${tile.iy}" ${DATA_MARKS.sign}="derived" ` +
        `${DATA_MARKS.state}="${escapeXml(tile.opaque.state)}" ${DATA_MARKS.proof_ref}="${escapeXml(tile.opaque.proofRef)}">`,
      `<circle cx="${cx}" cy="${cy}" r="5" fill="${p.paperElev}" stroke="${p.proof}" stroke-width="2" />`,
      `<text x="${cx}" y="${cy - 10}" fill="${p.ink}" font-size="11" text-anchor="middle">${escapeXml(labelText)}</text>`,
      `</g>`
    );
  }

  // Cliff distance callouts (every marker has a dedicated published proof_ref)
  const legGlyph = resolveSignSpec('origin_vendor').glyph;
  for (let idx = 0; idx < model.cliffMarkers.length; idx++) {
    const marker = model.cliffMarkers[idx]!;
    const my = padTop + plotH + 44 + idx * 14;
    parts.push(
      `<g ${DATA_MARKS.key}="cliff:${escapeXml(marker.subjectId)}" ${DATA_MARKS.sign}="origin_vendor" ` +
        `${DATA_MARKS.proof_ref}="${escapeXml(marker.proofRef)}">`,
      `<text x="${padLeft}" y="${my}" fill="${p.proof}" font-size="11">${escapeXml(`${legGlyph} ${marker.subjectId}: ${marker.display}`)}</text>`,
      `</g>`
    );
  }

  parts.push('</svg>');
  return parts.join('');
}
