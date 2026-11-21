/**
 * Dynamic std-view Verb Visibility & Answer Table Projection for @rezono/slip (Decision 0006).
 * Strictly zero-compute: verbs appear in canonical STD_VERBS (std-view Sheets.verbs) order
 * solely when the reader answers their question for a line, and adding a reader question
 * auto-surfaces its button[data-verb][data-key] and table[data-answer] with zero page code changes.
 */

import { STD_VERBS, canonicalJson } from '../../reader-core/src/index.ts';
import type { RawCellInput, StdVerbSpec } from '../../reader-core/src/index.ts';

export interface SlipVerbAnswerRow {
  readonly cells: readonly string[];
  readonly proof_ref?: string;
  readonly sign?: string;
}

export interface SlipVerbAnswerTable {
  readonly question: string;
  readonly verb: string;
  readonly headers: readonly string[];
  readonly rows: readonly SlipVerbAnswerRow[];
}

export interface ReaderVerbCapability {
  readonly answeredQuestions?: readonly string[];
  readonly answeredVerbs?: readonly string[];
  readonly answersByQuestion?: Readonly<Record<string, SlipVerbAnswerTable>>;
}

export interface VerbGroundLineLike {
  readonly relation: string;
  readonly key: readonly string[];
  readonly sign: string;
  readonly cell: RawCellInput;
}

export interface VerbCalcStepLike {
  readonly path: string;
  readonly sign: string;
  readonly cell: RawCellInput;
}

export interface VerbConformanceRowLike {
  readonly rule_id: string;
  readonly grounds_distance_1?: readonly VerbGroundLineLike[];
  readonly result_cell?: RawCellInput;
  readonly steps?: readonly VerbCalcStepLike[];
}

function matchStdVerb(token: string): StdVerbSpec | undefined {
  return STD_VERBS.find((s) => s.verb === token || s.question === token || s.key === token);
}

/**
 * Resolves all canonical verb names answered by the reader capability config,
 * ordered strictly in STD_VERBS (std-view Sheets.verbs) order.
 */
export function resolveReaderExtraVerbs(reader?: ReaderVerbCapability | null): readonly string[] {
  if (!reader) return [];
  const matched = new Set<string>();
  for (const token of reader.answeredVerbs ?? []) {
    const spec = matchStdVerb(token);
    if (spec) matched.add(spec.verb);
  }
  for (const token of reader.answeredQuestions ?? []) {
    const spec = matchStdVerb(token);
    if (spec) matched.add(spec.verb);
  }
  for (const question of Object.keys(reader.answersByQuestion ?? {})) {
    const spec = matchStdVerb(question);
    if (spec) matched.add(spec.verb);
  }
  return STD_VERBS.filter((s) => matched.has(s.verb)).map((s) => s.verb);
}

/**
 * Merges line-level answered verbs with reader-level extra verbs in canonical STD_VERBS order.
 */
export function mergeLineAnsweredVerbs(
  lineVerbs: readonly string[] | undefined,
  extraVerbs: readonly string[]
): readonly string[] {
  const allowed = new Set<string>();
  for (const token of lineVerbs ?? []) {
    const spec = matchStdVerb(token);
    if (spec) allowed.add(spec.verb);
  }
  for (const token of extraVerbs) {
    const spec = matchStdVerb(token);
    if (spec) allowed.add(spec.verb);
  }
  return STD_VERBS.filter((s) => allowed.has(s.verb)).map((s) => s.verb);
}

/**
 * Returns the exact StdVerbSpec[] to render for a line, in canonical STD_VERBS order.
 */
export function resolveLineVerbs(
  answeredVerbs: readonly string[] | undefined,
  extraVerbs: readonly string[] = []
): readonly StdVerbSpec[] {
  const merged = mergeLineAnsweredVerbs(answeredVerbs, extraVerbs);
  if (merged.length === 0) return [];
  const allowed = new Set(merged);
  return STD_VERBS.filter((spec) => allowed.has(spec.verb));
}

/**
 * Physical lock for [P] Propose on line verb buttons under unsealed provisional_engine streams.
 */
export function isLineVerbDisabled(spec: StdVerbSpec, proposeAllowed: boolean): boolean {
  return spec.verb === 'propose' && !proposeAllowed;
}

/**
 * Builds the table[data-answer="<question>"] payload for an opened verb.
 * Prefers reader-supplied answersByQuestion; otherwise projects directly from published row marks
 * without client-side compute or fabricated proof refs.
 */
export function buildAnswerTable(
  spec: StdVerbSpec,
  row: VerbConformanceRowLike | null,
  reader?: ReaderVerbCapability | null
): SlipVerbAnswerTable {
  const explicit = reader?.answersByQuestion?.[spec.question];
  if (explicit) {
    return {
      question: spec.question,
      verb: spec.verb,
      headers: explicit.headers,
      rows: explicit.rows
    };
  }

  if (spec.question === 'grounds' && row?.grounds_distance_1) {
    return {
      question: spec.question,
      verb: spec.verb,
      headers: ['Relation', 'Key', 'State', 'Proof'],
      rows: row.grounds_distance_1.map((line) => ({
        cells: [line.relation, canonicalJson(line.key), line.cell.state, line.cell.proof_ref],
        proof_ref: line.cell.proof_ref,
        sign: line.sign
      }))
    };
  }

  if (spec.question === 'reach' && row?.grounds_distance_1) {
    return {
      question: spec.question,
      verb: spec.verb,
      headers: ['Rule', 'Relation', 'Proof'],
      rows: row.grounds_distance_1.map((line) => ({
        cells: [row.rule_id, line.relation, line.cell.proof_ref],
        proof_ref: line.cell.proof_ref,
        sign: line.sign
      }))
    };
  }

  if (row?.grounds_distance_1 && row.grounds_distance_1.length > 0) {
    return {
      question: spec.question,
      verb: spec.verb,
      headers: ['Question', 'Relation', 'State', 'Proof'],
      rows: row.grounds_distance_1.map((line) => ({
        cells: [spec.question, line.relation, line.cell.state, line.cell.proof_ref],
        proof_ref: line.cell.proof_ref,
        sign: line.sign
      }))
    };
  }

  if (row?.steps && row.steps.length > 0) {
    return {
      question: spec.question,
      verb: spec.verb,
      headers: ['Question', 'Step', 'State', 'Proof'],
      rows: row.steps.map((step) => ({
        cells: [spec.question, step.path, step.cell.state, step.cell.proof_ref],
        proof_ref: step.cell.proof_ref,
        sign: step.sign
      }))
    };
  }

  if (row?.result_cell) {
    return {
      question: spec.question,
      verb: spec.verb,
      headers: ['Question', 'Rule', 'State', 'Proof'],
      rows: [
        {
          cells: [spec.question, row.rule_id, row.result_cell.state, row.result_cell.proof_ref],
          proof_ref: row.result_cell.proof_ref
        }
      ]
    };
  }

  return {
    question: spec.question,
    verb: spec.verb,
    headers: ['Question', 'Rule', 'Proof'],
    rows: []
  };
}
