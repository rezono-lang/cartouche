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

interface HeadSnapshot {
  readonly relation: string;
  readonly full?: boolean;
}

interface HeadBody {
  readonly manifest_sha256?: string;
  readonly epoch?: number;
  readonly knowledge_time?: string;
  readonly witness_check?: string;
  readonly trust_tier?: ManifestMeta['trust_tier'];
  readonly snapshots?: readonly HeadSnapshot[];
}

interface BundleAttribute {
  readonly id: string;
  readonly table: string;
}

interface BundleBody {
  readonly relations: readonly BundleRelation[];
  readonly attributes?: readonly BundleAttribute[];
}

function readRoleMeta(
  answers: Readonly<Record<string, GateRecordedAnswer>>,
  pack: string,
  role: string,
  fallbackManifest: ManifestMeta
): {
  readonly manifest: ManifestMeta;
  readonly horizon: { readonly complete: boolean; readonly reason: string | null };
} {
  const headAnswer = answers[`/${pack}/head`];
  if (!headAnswer || headAnswer.status !== 200 || !headAnswer.body || typeof headAnswer.body !== 'object') {
    return {
      manifest: { ...fallbackManifest, role },
      horizon: { complete: true, reason: null }
    };
  }
  const body = headAnswer.body as HeadBody;
  const partial = Array.isArray(body.snapshots) && body.snapshots.some((s) => s.full === false);
  return {
    manifest: {
      id: typeof body.manifest_sha256 === 'string' ? `sha256:${body.manifest_sha256}` : fallbackManifest.id,
      epoch: typeof body.epoch === 'number' ? body.epoch : fallbackManifest.epoch,
      knowledge_time: typeof body.knowledge_time === 'string' ? body.knowledge_time : fallbackManifest.knowledge_time,
      role,
      witness_check: body.witness_check === 'green' ? 'green' : fallbackManifest.witness_check,
      trust_tier: body.trust_tier ?? fallbackManifest.trust_tier
    },
    horizon: partial
      ? { complete: false, reason: 'not_read_in_full' }
      : { complete: true, reason: null }
  };
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
    readonly relation?: string;
  }
): BitemporalFixtureInput {
  const roleAnswers = recording.reader_answers[options.role];
  if (!roleAnswers) {
    throw new Error(`Gate recording has no answers for role "${options.role}"`);
  }

  const { manifest, horizon } = readRoleMeta(roleAnswers, options.pack, options.role, recording.manifest);
  const selected = recording.epochs.filter((ep) => ep.as_of === options.validTime);
  if (selected.length === 0) {
    throw new Error(`Gate recording has no epochs matching validTime="${options.validTime}"`);
  }

  const validTimes = [options.validTime];
  const epochs: string[] = [];
  const matrix: BitemporalCellInput[][] = [];
  const colsCache = new Map<string, RelationColumnIndices>();

  if (options.relation) {
    const bundlePath = `/${options.pack}/bundle`;
    const bundleAnswer = roleAnswers[bundlePath];
    const bundleBody = bundleAnswer && bundleAnswer.status === 200 && bundleAnswer.body && typeof bundleAnswer.body === 'object'
      ? (bundleAnswer.body as BundleBody)
      : null;
    const isAttrTable = Boolean(
      bundleBody && Array.isArray(bundleBody.attributes) && bundleBody.attributes.some((a) => a.table === options.relation)
    );
    const hasCalcRel = Boolean(
      bundleBody && Array.isArray(bundleBody.relations) && bundleBody.relations.some((r) => r.id === options.relation)
    );

    if (isAttrTable) {
      for (const ep of selected) {
        const rowPath = `/${options.pack}/${ep.manifest}/rows/${options.relation}`;
        const answer = roleAnswers[rowPath];
        if (!answer || answer.status !== 200 || !answer.body || typeof answer.body !== 'object') continue;
        const rows = (answer.body as GateRowsBody).rows;
        if (!Array.isArray(rows)) continue;
        const match = rows.find((entry) => Array.isArray(entry.key) && String(entry.key[0]) === options.subjectId);
        if (!match) continue;
        epochs.push(`${ep.manifest} (${ep.known})`);
        matrix.push([{
          state: 'known',
          display: String(match.key[1] ?? ''),
          proof_ref: `${ep.manifest}/${options.relation}/${JSON.stringify(match.key)}`
        }]);
      }
      return {
        manifest,
        horizon,
        bitemporal_grid: {
          projection: 'orthographic',
          valid_times: validTimes,
          epochs,
          matrix,
          flat_known_tiles: true
        }
      };
    }

    if (!hasCalcRel) {
      return {
        manifest,
        horizon,
        bitemporal_grid: {
          projection: 'orthographic',
          valid_times: validTimes,
          epochs: [],
          matrix: [],
          flat_known_tiles: true
        }
      };
    }
  }

  for (const ep of selected) {
    const relName = options.relation ?? ep.relation;
    let cols = colsCache.get(relName);
    if (!cols) {
      cols = resolveRelationColumns(roleAnswers, options.pack, relName);
      colsCache.set(relName, cols);
    }

    epochs.push(`${ep.manifest} (${ep.known})`);
    const row = findSubjectRow(roleAnswers, options.pack, { ...ep, relation: relName }, options.subjectId, cols.subject);
    const rawValue = String(row.key[cols.value] ?? '');
    const rawState = String(row.key[cols.state] ?? '');
    const rawReason = String(row.key[cols.reason] ?? '');
    const proofRef = `${ep.manifest}/${relName}/${JSON.stringify(row.key)}`;

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
    manifest,
    horizon,
    bitemporal_grid: {
      projection: 'orthographic',
      valid_times: validTimes,
      epochs,
      matrix,
      flat_known_tiles: true
    }
  };
}
