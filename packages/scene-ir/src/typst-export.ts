/**
 * Decision 0003: Deterministic Typst (Apache-2.0) source emitter for CartoucheScene v2 IR.
 *
 * Pure text generation: no Typst binary, no fonts, no clock, no locale. The same scene
 * always yields byte-identical `.typ` source, and `#set document(date: none)` keeps the
 * compiled PDF free of a creation timestamp.
 *
 * Zero client compute: every displayed string is an opaque server-projected token. Marks,
 * proofs, witnesses and the manifest seal are copied verbatim; nothing is derived,
 * rounded or defaulted. Malformed marks throw instead of being repaired.
 */

import { SIGNS, renderOpaqueText } from '../../reader-core/src/index.ts';
import type { CartoucheScene, SceneNodeMark } from './types.ts';
import { assertXDDiscipline } from './xd-guard.ts';

export interface TypstExportOptions {
  /** Document title; defaults to the scene archetype. */
  readonly title?: string;
  /**
   * Published reasons for `unknown` marks whose scene node carries no cell
   * (the scene IR keeps the reason only on cells and manifolds).
   */
  readonly reasonByNodeId?: Readonly<Record<string, string>> | undefined;
}

const DIGIT_RE = /[0-9]/;
const NON_ORIGIN_STATES = new Set(['unknown', 'absent', 'not_applicable', 'invalid']);
const STATE_GLYPH_STATES = new Set(['valid', 'changed', 'violated']);

/** Quote an arbitrary string as a Typst string literal. */
export function typstString(text: string): string {
  let out = '"';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (ch === '\\') out += '\\\\';
    else if (ch === '"') out += '\\"';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (code < 0x20 || code === 0x7f) out += `\\u{${code.toString(16)}}`;
    else out += ch;
  }
  return `${out}"`;
}

function glyphOf(sign: string): string {
  const spec = Object.prototype.hasOwnProperty.call(SIGNS, sign) ? SIGNS[sign] : undefined;
  if (!spec) throw new Error(`Typst export: no std-view sign for "${sign}".`);
  return spec.glyph;
}

function requireProof(ref: string | null | undefined, what: string): string {
  if (!ref || ref.trim().length === 0) {
    throw new Error(`Typst export: ${what} has no proof reference (zero-proof marks are rejected).`);
  }
  return ref;
}

function unknownReason(node: SceneNodeMark, scene: CartoucheScene, options: TypstExportOptions): string {
  const fromCell = node.cell?.reason ?? null;
  const fromManifold = scene.unknownManifolds.find((m) => m.subjectId === node.id)?.reason ?? null;
  const fromOptions = options.reasonByNodeId?.[node.id] ?? null;
  const reason = fromCell ?? fromManifold ?? fromOptions;
  if (!reason || reason.trim().length === 0) {
    throw new Error(`Typst export: unknown mark "${node.id}" has no published reason.`);
  }
  if (DIGIT_RE.test(reason)) {
    throw new Error(`Typst export: unknown mark "${node.id}" reason must not contain digits.`);
  }
  return reason;
}

function markCall(node: SceneNodeMark, scene: CartoucheScene, options: TypstExportOptions): string {
  const origin = typstString(node.sign);
  const state = typstString(node.state);
  if (node.state === 'unknown') {
    return `mark(${state}, ${origin}, reason: ${typstString(unknownReason(node, scene, options))})`;
  }
  if (node.state === 'absent') {
    requireProof(node.completenessWitnessRef, `absent mark "${node.id}" completeness witness`);
    return `mark(${state}, ${origin})`;
  }
  if (node.state === 'not_applicable') {
    const reason = node.cell?.reason ?? options.reasonByNodeId?.[node.id] ?? null;
    return reason ? `mark(${state}, ${origin}, reason: ${typstString(reason)})` : `mark(${state}, ${origin})`;
  }
  if (node.cell && node.cell.state === 'known' && node.cell.display !== null) {
    return `mark(${state}, ${origin}, display: ${typstString(renderOpaqueText(node.cell))})`;
  }
  return `mark(${state}, ${origin})`;
}

function proofCell(node: SceneNodeMark): string {
  const proof = requireProof(node.proofRef, `mark "${node.id}"`);
  if (node.state === 'absent') {
    const witness = requireProof(node.completenessWitnessRef, `absent mark "${node.id}" completeness witness`);
    return `proof-cell(${typstString(proof)}, witness: ${typstString(witness)})`;
  }
  return `proof-cell(${typstString(proof)})`;
}

/** Signs actually drawn by this scene, in canonical std-view order. */
export function drawnSigns(scene: CartoucheScene): readonly string[] {
  const used = new Set<string>();
  for (const n of scene.nodes) {
    used.add(n.sign);
    if (NON_ORIGIN_STATES.has(n.state) || STATE_GLYPH_STATES.has(n.state)) used.add(n.state);
  }
  if (scene.driftEdges.length > 0) used.add('drift');
  for (const s of used) glyphOf(s);
  return Object.keys(SIGNS).filter((k) => used.has(k));
}

const PRELUDE = (): string => {
  const glyphs = Object.keys(SIGNS)
    .map((k) => `${k}: ${typstString(glyphOf(k))}`)
    .join(', ');
  return [
    `#let sign-glyph = (${glyphs})`,
    '#let hatch-box = box(width: 14pt, height: 9pt, stroke: 0.5pt + luma(110), clip: true)[',
    '  #place(top + left, line(start: (0pt, 9pt), end: (9pt, 0pt), stroke: 0.5pt + luma(110)))',
    '  #place(top + left, line(start: (5pt, 9pt), end: (14pt, 0pt), stroke: 0.5pt + luma(110)))',
    '  #place(top + left, line(start: (10pt, 9pt), end: (19pt, 0pt), stroke: 0.5pt + luma(110)))',
    ']',
    '#let hollow-box = box(width: 14pt, height: 9pt, stroke: (paint: luma(110), thickness: 0.5pt, dash: "dashed"))',
    '#let mark(state, origin, reason: none, display: none) = {',
    '  sign-glyph.at(origin)',
    '  h(3pt)',
    '  if state == "unknown" {',
    '    hatch-box',
    '    h(3pt)',
    '    reason',
    '  } else if state == "not_applicable" {',
    '    hollow-box',
    '    if reason != none { h(3pt); reason }',
    '  } else if state == "absent" {',
    '    sign-glyph.absent',
    '  } else if state == "invalid" {',
    '    sign-glyph.violated',
    '  } else if display != none {',
    '    if state in ("valid", "changed", "violated") { sign-glyph.at(state); h(3pt) }',
    '    display',
    '  } else if state in ("valid", "changed", "violated") {',
    '    sign-glyph.at(state)',
    '  }',
    '}',
    '#let proof-cell(proof, witness: none) = {',
    '  raw(proof)',
    '  if witness != none { linebreak(); [witness: ]; raw(witness) }',
    '}',
    '#let drift-mark(src, dst, name, stated, observed) = block(width: 100%, inset: 4pt, stroke: 0.4pt + luma(150), breakable: false)[',
    '  #sign-glyph.drift #name: #src #sym.arrow.r #dst',
    '  #grid(columns: (auto, 1fr, auto), gutter: 4pt, align: horizon,',
    '    [stated], line(length: 100%, stroke: 0.8pt), raw(stated),',
    '    [observed], line(length: 100%, stroke: 0.8pt), raw(observed))',
    ']',
    '#let seal-block(manifest, epoch, knowledge, role, witness, tier, provisional) = block(width: 100%, inset: 6pt, stroke: 0.8pt)[',
    '  #text(weight: "bold")[Cartouche seal] #h(6pt) #raw(manifest) \\',
    '  tier: #raw(tier) #h(6pt) witness: #raw(witness) #h(6pt) role: #raw(role) \\',
    '  epoch: #raw(epoch) #h(6pt) knowledge time: #raw(knowledge) #h(6pt) provisional: #raw(provisional)',
    ']',
    '#let banner(text-body) = block(width: 100%, inset: 6pt, stroke: (paint: luma(40), thickness: 1.2pt, dash: "dashed"), text(weight: "bold", text-body))'
  ].join('\n');
};

function table(columns: number, header: readonly string[], cells: readonly string[]): string {
  const head = header.map((h) => typstString(h)).join(', ');
  return [
    `#table(columns: ${columns}, table.header(${head}),`,
    ...cells.map((c) => `  ${c},`),
    ')'
  ].join('\n');
}

function sceneBody(scene: CartoucheScene, options: TypstExportOptions): string {
  assertXDDiscipline(scene);
  const seal = scene.seal;
  const out: string[] = [];

  out.push(`#heading(level: 1, ${typstString(options.title ?? scene.archetype)})`);
  out.push(
    `#seal-block(${[
      seal.manifestId,
      String(seal.epoch),
      seal.knowledgeTime,
      seal.role,
      seal.witnessCheck,
      seal.trustTier,
      String(seal.provisionalCount)
    ]
      .map((v) => typstString(v))
      .join(', ')})`
  );
  if (seal.trustTier !== 'sealed' || !seal.canPropose) {
    out.push(`#banner(${typstString(`${seal.trustTier}: unsealed, Propose and approval are locked`)})`);
  }
  if (!scene.horizon.complete) {
    out.push(`#banner(${typstString(scene.horizon.reason ? `incomplete: ${scene.horizon.reason}` : 'incomplete')})`);
  }

  out.push('#heading(level: 2, "Axes")');
  out.push(
    table(
      4,
      ['Axis', 'Dimension', 'Kind', 'Label'],
      scene.axes.flatMap((a) => [a.axis, a.dim, a.kind, a.label].map((v) => typstString(v)))
    )
  );
  

  out.push(`#text(size: 8pt, ${typstString(`projection: ${scene.projection}`)})`);

  out.push('#heading(level: 2, "Marks")');
  out.push(
    table(
      3,
      ['Mark', 'Item', 'Proof'],
      scene.nodes.flatMap((n) => [markCall(n, scene, options), typstString(n.label), proofCell(n)])
    )
  );

  if (scene.driftEdges.length > 0) {
    out.push('#heading(level: 2, "Drift")');
    for (const e of scene.driftEdges) {
      const stated = requireProof(e.statedProofRef, `drift "${e.id}" stated side`);
      const observed = requireProof(e.observedProofRef, `drift "${e.id}" observed side`);
      out.push(
        `#drift-mark(${[e.from, e.to, e.label, stated, observed].map((v) => typstString(v)).join(', ')})`
      );
    }
  }

  if (scene.unknownManifolds.length > 0) {
    out.push('#heading(level: 2, "Uncertainty curtains")');
    out.push(
      table(
        3,
        ['Mark', 'Subject', 'Proof'],
        scene.unknownManifolds.flatMap((m) => {
          if (!m.reason || DIGIT_RE.test(m.reason)) {
            throw new Error(`Typst export: curtain "${m.subjectId}" needs a published digit-free reason.`);
          }
          return [
            `mark("unknown", "derived", reason: ${typstString(m.reason)})`,
            typstString(m.subjectId),
            `proof-cell(${typstString(requireProof(m.proofRef, `curtain "${m.subjectId}"`))})`
          ];
        })
      )
    );
  }

  out.push('#heading(level: 2, "Table twin")');
  out.push(
    table(
      scene.tableTwin.headers.length,
      scene.tableTwin.headers,
      scene.tableTwin.rows.flatMap((r) => r.map((v) => typstString(v)))
    )
  );

  out.push('#heading(level: 2, "Legend")');
  out.push(
    table(
      3,
      ['Sign', 'Name', 'Pattern'],
      drawnSigns(scene).flatMap((s) => [typstString(glyphOf(s)), typstString(s), typstString(SIGNS[s]!.pattern)])
    )
  );

  return out.join('\n');
}

function footerSet(scene: CartoucheScene): string {
  const seal = scene.seal;
  return `#set page(footer: align(center, text(size: 7pt, raw(${typstString(`${seal.manifestId} ${seal.trustTier}`)}))))`;
}

function documentHead(title: string): string {
  return [
    '// cartouche.scene/2 -> Typst (deterministic, generated)',
    `#set document(title: ${typstString(title)}, date: none)`,
    '#set page(paper: "a4", margin: (x: 18mm, y: 20mm))',
    '#set text(size: 9pt)',
    PRELUDE()
  ].join('\n');
}

/** Emit one Typst document for a single scene. */
export function exportTypst(scene: CartoucheScene, options: TypstExportOptions = {}): string {
  const title = options.title ?? scene.archetype;
  return `${documentHead(title)}\n${footerSet(scene)}\n${sceneBody(scene, options)}\n`;
}

/**
 * Emit one Typst dossier for several scenes. Every scene starts on a fresh page and sets its
 * OWN page footer, so a page never shows another scene's manifest or trust tier.
 */
export function exportTypstDossier(
  scenes: readonly CartoucheScene[],
  options: TypstExportOptions & { readonly reasonsByScene?: readonly (Readonly<Record<string, string>> | undefined)[] } = {}
): string {
  if (scenes.length === 0) throw new Error('Typst export: a dossier needs at least one scene.');
  const title = options.title ?? 'dossier';
  const parts = scenes.map((s, i) => {
    const body = sceneBody(s, { reasonByNodeId: options.reasonsByScene?.[i] ?? options.reasonByNodeId });
    return `${footerSet(s)}\n${body}`;
  });
  return `${documentHead(title)}\n${parts.join('\n#pagebreak()\n')}\n`;
}