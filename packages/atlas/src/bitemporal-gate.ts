/**
 * Zero-Compute Gate-Output Builder for Sheet 05 (Bitemporal Staircase).
 * Decision 0012 §2: transforms recorded Rezono gate answers into a `BitemporalFixtureInput`
 * without deriving, parsing, normalizing, diffing, or thresholding any business value.
 *
 * Every cell carries:
 *  - the exact opaque string `display`, `state`, and `reason` served by `edge/gate/src/local.ts`
 *    (resolved by column name from the recorded `/<pack>/bundle` schema, never by hardcoded indices)
 *  - a `proof_ref` naming `<manifest>/<relation>/<canonical-key>` from the recorded gate response
 *  - `flat_known_tiles: true` so 3D orthographic view never invents a client-computed Z height.
 */

import type { ManifestMeta } from '../../reader-core/src/index.ts';
import type {
  BitemporalCellInput,
  BitemporalFixtureInput
} from '../../scene-ir/src/compile-bitemporal.ts';

export interface GateRecordedAnswer {
  readonly status: number;
  readonly body: unknown;
}

export interface GateEpochEntry {
  readonly manifest: string;
  readonly as_of: string;
  readonly known: string;
  readonly relation: string;
}

export interface BitemporalGateRecording {
  readonly fixture_id: string;
  readonly manifest: ManifestMeta;
  readonly source: {
    readonly decision: string;
    readonly repository: string;
    readonly commit: string;
    readonly pack: string;
    readonly store: string;
    readonly how: string;
    readonly recorded_by: string | null;
  };
  readonly epochs: readonly GateEpochEntry[];
  readonly reader_answers: {
    readonly [role: string]: {
      readonly [path: string]: GateRecordedAnswer;
    };
  };
}

interface GateRowEntry {
  readonly key: readonly unknown[];
}

interface GateRowsBody {
  readonly rows: readonly GateRowEntry[];
}

interface BundleColumn {
  readonly name: string;
}

interface BundleRelation {
  readonly id: string;
  readonly columns: readonly BundleColumn[];
}

interface BundleBody {
  readonly relations: readonly BundleRelation[];
}

interface RelationColumnIndices {
  readonly subject: number;
  readonly value: number;
  readonly state: number;
  readonly reason: number;
}

function resolveRelationColumns(
  answers: Readonly<Record<string, GateRecordedAnswer>>,
  pack: string,
  relationId: string
): RelationColumnIndices {
  const bundlePath = `/${pack}/bundle`;
  const bundleAnswer = answers[bundlePath];
  if (!bundleAnswer || bundleAnswer.status !== 200 || !bundleAnswer.body || typeof bundleAnswer.body !== 'object') {
    throw new Error(`Gate recording missing 200 bundle answer at ${bundlePath}`);
  }
  const relations = (bundleAnswer.body as BundleBody).relations;
  if (!Array.isArray(relations)) {
    throw new Error(`Gate recording bundle at ${bundlePath} has no relations array`);
  }
  const rel = relations.find((r) => r.id === relationId);
  if (!rel || !Array.isArray(rel.columns)) {
    throw new Error(`Gate recording bundle at ${bundlePath} has no relation "${relationId}"`);
  }
  const byName = new Map<string, number>();
  rel.columns.forEach((col: BundleColumn, index: number) => byName.set(col.name, index));
  const subject = byName.get('subject');
  const value = byName.get('value');
  const state = byName.get('state');
  const reason = byName.get('reason');
  if (subject === undefined || value === undefined || state === undefined || reason === undefined) {
    throw new Error(`Relation "${relationId}" in ${bundlePath} is missing required columns (subject, value, state, reason)`);
  }
  return { subject, value, state, reason };
}

function findSubjectRow(
  answers: Readonly<Record<string, GateRecordedAnswer>>,
  pack: string,
  epoch: GateEpochEntry,
  subjectId: string,
  subjectCol: number
): GateRowEntry {
  const path = `/${pack}/${epoch.manifest}/rows/${epoch.relation}`;
  const answer = answers[path];
  if (!answer || answer.status !== 200 || !answer.body || typeof answer.body !== 'object') {
    throw new Error(`Gate recording missing 200 rows answer at ${path}`);
  }
  const rows = (answer.body as GateRowsBody).rows;
  if (!Array.isArray(rows)) {
    throw new Error(`Gate recording rows answer at ${path} has no rows array`);
  }
  const match = rows.find((entry) => Array.isArray(entry.key) && String(entry.key[subjectCol]) === subjectId);
  if (!match) {
    throw new Error(`Gate recording at ${path} has no row for subject "${subjectId}"`);
  }
  return match;
}

/**
 * Build a `BitemporalFixtureInput` for one subject over the epochs recorded for a given
 * `validTime` (`as_of`) from recorded Rezono gate output.
 *
 * Zero client compute: every display value, epistemic state, and reason is projected verbatim
 * using column positions resolved by name from `/<pack>/bundle`, with zero client-side epoch
 * diffing, zero synthesized fallback reasons, and zero unrecorded proof references.
 */
export function buildBitemporalFixtureFromGateAnswers(
  recording: BitemporalGateRecording,
  options: {
    readonly pack: string;
    readonly role: string;
    readonly subjectId: string;
    readonly validTime: string;
  }
): BitemporalFixtureInput {
  const roleAnswers = recording.reader_answers[options.role];
  if (!roleAnswers) {
    throw new Error(`Gate recording has no answers for role "${options.role}"`);
  }

  const selected = recording.epochs.filter((ep) => ep.as_of === options.validTime);
  if (selected.length === 0) {
    throw new Error(`Gate recording has no epochs matching validTime="${options.validTime}"`);
  }

  const validTimes = [options.validTime];
  const epochs: string[] = [];
  const matrix: BitemporalCellInput[][] = [];
  const colsCache = new Map<string, RelationColumnIndices>();

  for (const ep of selected) {
    let cols = colsCache.get(ep.relation);
    if (!cols) {
      cols = resolveRelationColumns(roleAnswers, options.pack, ep.relation);
      colsCache.set(ep.relation, cols);
    }

    epochs.push(`${ep.manifest} (${ep.known})`);
    const row = findSubjectRow(roleAnswers, options.pack, ep, options.subjectId, cols.subject);
    const rawValue = String(row.key[cols.value] ?? '');
    const rawState = String(row.key[cols.state] ?? '');
    const rawReason = String(row.key[cols.reason] ?? '');
    const proofRef = `${ep.manifest}/${ep.relation}/${JSON.stringify(row.key)}`;

    if (rawState === 'unknown') {
      if (!rawReason) {
        throw new Error(`Gate row at ${proofRef} has state "unknown" without a published reason`);
      }
      matrix.push([{
        state: 'unknown',
        display: null,
        reason: rawReason,
        proof_ref: proofRef
      }]);
    } else if (rawState === 'known') {
      matrix.push([{
        state: 'known',
        display: rawValue,
        proof_ref: proofRef
      }]);
    } else if (rawState === 'not_applicable') {
      if (!rawReason) {
        throw new Error(`Gate row at ${proofRef} has state "not_applicable" without a published reason`);
      }
      matrix.push([{
        state: 'not_applicable',
        reason: rawReason,
        proof_ref: proofRef
      }]);
    } else if (rawState === 'invalid') {
      if (!rawReason) {
        throw new Error(`Gate row at ${proofRef} has state "invalid" without a published reason`);
      }
      matrix.push([{
        state: 'invalid',
        reason: rawReason,
        proof_ref: proofRef
      }]);
    } else {
      throw new Error(`Unsupported epistemic state "${rawState}" at ${proofRef}`);
    }
  }

  return {
    manifest: recording.manifest,
    bitemporal_grid: {
      projection: 'orthographic',
      valid_times: validTimes,
      epochs,
      matrix,
      flat_known_tiles: true
    }
  };
}
