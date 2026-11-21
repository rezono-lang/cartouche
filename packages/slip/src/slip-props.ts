/**
 * From the slip's view (src/model.ts, built from the reader's answers) to the props of the one Slip.svelte
 * (Decision 0010). Build time only. It renames and regroups; it decides nothing the view has not decided:
 *  - line `index` (from 0) becomes `data-line`; sentence segments keep the index they link to;
 *  - each value becomes an opaque cell; a non-known value carries the publication's reason as given;
 *  - an absent line's completeness is the role's snapshot of that relation, read in full (`full` in the head);
 *  - each stop carries, per line, the fold the model computed from its variant's published difference;
 *  - a sign is drawn only when Cartouche's frozen key has it (Rezono's rule: a sign not in the key is not drawn);
 *    the ones left out are returned, so a page can say so (Decision 0010, point 6).
 */

import { SIGNS } from '../../reader-core/src/index.ts';
import type { RawCellInput } from '../../reader-core/src/index.ts';
import type { AnswerTable, HeadResponse, LineFold, SignInfo, SlipLine, SlipView, ValueState } from './types.ts';

export interface SlipPropsSentenceSegment {
  readonly text: string;
  readonly line?: number | undefined;
}

export interface SlipPropsLine {
  readonly part?: 'total' | undefined;
  readonly relation: string;
  readonly key: readonly string[];
  readonly polarity: 'positive' | 'negative';
  readonly depth: number;
  readonly path?: string | undefined;
  readonly label?: string | undefined;
  readonly sign?: string | undefined;
  readonly cell: RawCellInput;
  readonly answered_verbs: readonly string[];
}

export interface SlipPropsFold {
  readonly line: number;
  readonly cell: RawCellInput;
}

export interface SlipPropsStop {
  readonly index: number;
  readonly display: string;
  readonly status: 'green' | 'warning' | 'red' | 'not_computed' | 'unavailable';
  readonly turn: 'turns' | 'same' | 'unknown' | null;
  readonly fold_display: string | null;
  readonly checks?: readonly { readonly id: string; readonly status: 'green' | 'warning' | 'red' | 'unavailable' }[] | undefined;
  readonly folds: readonly SlipPropsFold[];
}

export interface SlipPropsSweep {
  readonly line: number;
  readonly name: string;
  readonly unavailable: boolean;
  readonly note?: string | undefined;
  readonly stops: readonly SlipPropsStop[];
}

export interface SlipPropsAnswerCell {
  readonly text: string;
  readonly sign?: string | undefined;
}

export interface SlipPropsAnswer {
  readonly question: string;
  readonly verb: string;
  readonly heading?: string | undefined;
  readonly headers: readonly string[];
  readonly rows: readonly { readonly cells: readonly SlipPropsAnswerCell[]; readonly depth?: number | undefined }[];
  readonly note?: string | undefined;
}

export interface SlipPropsRow {
  readonly kind: 'rule' | 'calc';
  readonly rule_id: string;
  readonly sentence: readonly SlipPropsSentenceSegment[];
  readonly grounds_distance_1?: readonly SlipPropsLine[] | undefined;
  readonly steps?: readonly SlipPropsLine[] | undefined;
}

export interface SlipProps {
  readonly row: SlipPropsRow;
  readonly sweeps: readonly SlipPropsSweep[];
  /** Every answer table a verb on a line can open, by `<line>:<verb>`. */
  readonly answers: Readonly<Record<string, SlipPropsAnswer>>;
  readonly sealChecks: readonly { readonly id: string; readonly status: 'green' | 'warning' | 'red' }[];
  readonly manifestHash: string;
  /** Signs the reader's view uses that Cartouche's frozen key does not have: not drawn. */
  readonly signsLeftOut: readonly string[];
}

function keyParts(raw: string): string[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every((part) => typeof part === 'string')) {
    throw new Error(`slip props: key ${raw} is not a JSON list of strings`);
  }
  return parsed as string[];
}

/** A reference to the row that proves a line, in the manifest the reader served (Cartouche-local naming). */
export function rowProofRef(manifestId: string, relation: string, key: string, path?: string): string {
  return `${manifestId}:${relation}:${key}${path === undefined ? '' : `#${path}`}`;
}

// The role reads every row of the relation (`full` on its snapshot in the head), so a row it does not find is absent.
function completenessRef(head: HeadResponse, relation: string): string {
  const snapshot = head.snapshots.find((s) => s.relation === relation);
  if (!snapshot || snapshot.full !== true) {
    throw new Error(
      `slip props: absent ${relation}: the head gives no snapshot this role reads in full; refusing to draw an unwitnessed absence`
    );
  }
  return `${head.id}:snapshot:${relation}`;
}

function cellOf(
  state: ValueState,
  value: string,
  reason: string,
  proofRef: string,
  completeness: () => string
): RawCellInput {
  if (state === 'known') return { state, display: value, proof_ref: proofRef };
  if (state === 'absent') return { state, display: null, proof_ref: proofRef, completeness_witness_ref: completeness() };
  return { state, display: null, reason: reason === '' ? null : reason, proof_ref: proofRef };
}

export function slipPropsFromView(view: SlipView): SlipProps {
  if (view.kind !== 'slip' || !view.row) {
    throw new Error('slip props: the reader gave no row the role reads exactly once; the list of relations is not drawn yet');
  }
  const leftOut = new Set<string>();
  const drawable = (sign: SignInfo | undefined): string | undefined => {
    if (!sign) return undefined;
    if (Object.prototype.hasOwnProperty.call(SIGNS, sign.name)) return sign.name;
    leftOut.add(sign.name);
    return undefined;
  };

  const lineCell = (line: SlipLine): RawCellInput =>
    cellOf(line.state, line.value, line.reason, rowProofRef(view.manifestId, line.relation, line.key, line.path), () =>
      completenessRef(view.head, line.relation)
    );

  const lines: SlipPropsLine[] = view.lines.map((line) => ({
    part: line.part,
    relation: line.relation,
    key: keyParts(line.key),
    polarity: line.polarity,
    depth: line.depth,
    path: line.path,
    label: line.label,
    sign: drawable(line.originSign),
    cell: lineCell(line),
    answered_verbs: line.verbs.map((verb) => verb.verb)
  }));
  for (const line of view.lines) drawable(line.valueSign);

  const isCalc = view.lines.length > 0 && view.lines.every((line) => line.path !== undefined);
  const row: SlipPropsRow = {
    kind: isCalc ? 'calc' : 'rule',
    rule_id: view.row.relation,
    sentence: view.sentence.map((segment) => ({ text: segment.text, line: segment.line })),
    ...(isCalc ? { steps: lines } : { grounds_distance_1: lines })
  };

  const foldCell = (variant: string, fold: LineFold): RawCellInput => {
    drawable(fold.newSign);
    return cellOf(fold.newState, fold.newValue, fold.newReason, variant, () => variant);
  };

  const sweeps: SlipPropsSweep[] = [];
  for (const line of view.lines) {
    const sweep = line.sweep;
    if (!sweep) continue;
    sweeps.push({
      line: line.index,
      name: sweep.name,
      unavailable: sweep.unavailable,
      note: sweep.unavailable ? sweep.unavailableNote : undefined,
      stops: sweep.stops.map((stop) => {
        const byLine = stop.manifest === undefined ? {} : (view.foldsByVariant[stop.manifest] ?? {});
        const folds: SlipPropsFold[] = [];
        for (const target of view.lines) {
          const fold = byLine[target.index];
          if (fold && stop.manifest !== undefined) folds.push({ line: target.index, cell: foldCell(stop.manifest, fold) });
        }
        const own = folds.find((fold) => fold.line === line.index);
        return {
          index: stop.index,
          display: stop.value,
          status: stop.status,
          turn: stop.turn ?? null,
          fold_display: own && own.cell.state === 'known' ? (own.cell.display ?? null) : null,
          checks:
            stop.status === 'red'
              ? (stop.checks ?? []).map((check) => ({ id: check.name, status: check.status }))
              : undefined,
          folds
        };
      })
    });
  }

  const answers: Record<string, SlipPropsAnswer> = {};
  for (const [id, table] of Object.entries(view.answersByKey)) {
    const verb = id.slice(id.indexOf(':') + 1);
    answers[id] = answerOf(table, verb, drawable);
  }
  if (view.supposedSign) drawable(view.supposedSign);
  drawable(view.seal.sealSign);

  const sealChecks: { id: string; status: 'green' | 'warning' | 'red' }[] = [
    // The reader served this page, and it serves no object whose hash fails (Rezono decisions/viewer-slip.md, The seal).
    { id: 'reader-hashes', status: 'green' }
  ];
  if (view.seal.witnessCheck) sealChecks.push({ id: 'publisher-record', status: view.seal.witnessCheck });

  return {
    row,
    sweeps,
    answers,
    sealChecks,
    manifestHash: view.seal.manifestSha256,
    signsLeftOut: [...leftOut]
  };
}

function answerOf(
  table: AnswerTable,
  verb: string,
  drawable: (sign: SignInfo | undefined) => string | undefined
): SlipPropsAnswer {
  const notes = [table.cutMessage, table.moreLabel].filter((text): text is string => typeof text === 'string');
  return {
    question: table.question,
    verb,
    heading: table.heading,
    headers: table.headers,
    rows: table.rows.map((row) => ({
      depth: row.depth,
      cells: row.cells.map((cell) => ({ text: cell.text, sign: drawable(cell.sign) }))
    })),
    note: notes.length > 0 ? notes.join(' ') : undefined
  };
}
