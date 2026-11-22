/**
 * Decision 0012 §3a (Requirement 7): Bitemporal time & epoch transition helpers for the Proof Map.
 * - Resolves valid_at, known_at, and manifest id strictly from explicit controls and recorded epochs
 *   (zero wall-clock time, zero client date arithmetic).
 * - Projects published `epoch_diff` entries verbatim into `<del>` / `<ins>` proof-pinned records
 *   (zero client diffing).
 * - Projects served `/rows/<relation>` snapshots for a requested epoch into deterministic,
 *   non-overlapping row nodes with opaque published slot displays and explicit 4-valued epistemic state.
 */

export interface ProofMapEpochSelection {
  readonly manifestId: string;
  readonly validAt: string | null;
  readonly knownAt: string | null;
}

export interface ProofMapEpochDiffItem {
  readonly id: string;
  readonly relation: string;
  readonly key: string;
  readonly change: string;
  readonly oldDisplay: string | null;
  readonly oldHref: string | null;
  readonly oldProofRef: string | null;
  readonly newDisplay: string | null;
  readonly newHref: string | null;
  readonly newProofRef: string | null;
}

export interface ProofMapRowSlot {
  readonly name: string;
  readonly display: string;
}

export interface ProofMapEpochRowNode {
  readonly id: string;
  readonly relation: string;
  readonly key: string;
  readonly state: 'known' | 'unknown' | 'not_applicable' | 'absent' | 'invalid';
  readonly reason: string | null;
  readonly slots: readonly ProofMapRowSlot[];
  readonly proofRef: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface EpochRecordLike {
  readonly manifest?: unknown;
  readonly as_of?: unknown;
  readonly known?: unknown;
}

interface EpochDiffEntryLike {
  readonly relation?: unknown;
  readonly key?: unknown;
  readonly change?: unknown;
  readonly old_display?: unknown;
  readonly old_proof_iri?: unknown;
  readonly new_display?: unknown;
  readonly new_proof_iri?: unknown;
}

interface TimeFixtureLike {
  readonly manifest?: {
    readonly id?: unknown;
    readonly knowledge_time?: unknown;
  };
  readonly epochs?: readonly EpochRecordLike[];
  readonly epoch_diff?: {
    readonly from_manifest?: unknown;
    readonly to_manifest?: unknown;
    readonly entries?: readonly EpochDiffEntryLike[];
  };
  readonly reader_answers?: Readonly<
    Record<string, Readonly<Record<string, { readonly status?: unknown; readonly body?: unknown }>>>
  >;
}

const VALID_STATES = new Set(['known', 'unknown', 'not_applicable', 'absent', 'invalid']);

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function makePinnedHref(proofIri: string): string {
  const params = new URLSearchParams();
  params.set('at', proofIri);
  return `?${params.toString()}`;
}

/**
 * Resolves the active `(manifestId, validAt, knownAt)` strictly from caller controls
 * and recorded `fixture.epochs` / `fixture.manifest`.
 */
export function resolveProofMapEpoch(
  fixture: TimeFixtureLike,
  options: { readonly manifest?: string | undefined; readonly validAt?: string | undefined; readonly knownAt?: string | undefined } = {}
): ProofMapEpochSelection {
  const epochs = Array.isArray(fixture.epochs) ? fixture.epochs : [];
  let matched: EpochRecordLike | undefined;

  if (options.manifest) {
    matched = epochs.find((ep) => ep.manifest === options.manifest);
  }
  if (!matched && (options.validAt || options.knownAt)) {
    matched = epochs.find(
      (ep) =>
        (!options.validAt || ep.as_of === options.validAt) &&
        (!options.knownAt || ep.known === options.knownAt)
    );
  }

  const manifestId =
    options.manifest ??
    (typeof matched?.manifest === 'string' && matched.manifest.length > 0
      ? matched.manifest
      : typeof fixture.manifest?.id === 'string' && fixture.manifest.id.length > 0
        ? fixture.manifest.id
        : 'm-0');

  const validAt =
    options.validAt ??
    (typeof matched?.as_of === 'string' && matched.as_of.length > 0 ? matched.as_of : null);

  const knownAt =
    options.knownAt ??
    (typeof matched?.known === 'string' && matched.known.length > 0
      ? matched.known
      : typeof fixture.manifest?.knowledge_time === 'string' && fixture.manifest.knowledge_time.length > 0
        ? fixture.manifest.knowledge_time
        : null);

  return Object.freeze({ manifestId, validAt, knownAt });
}

/**
 * Projects published `fixture.epoch_diff.entries` verbatim into proof-pinned `<del>` / `<ins>` records.
 */
export function extractEpochDiffEntries(fixture: TimeFixtureLike): readonly ProofMapEpochDiffItem[] {
  const rawEntries = fixture.epoch_diff?.entries;
  if (!Array.isArray(rawEntries) || rawEntries.length === 0) return Object.freeze([]);

  const out: ProofMapEpochDiffItem[] = [];
  for (let i = 0; i < rawEntries.length; i++) {
    const entry = rawEntries[i];
    if (!entry || typeof entry !== 'object') continue;
    const relation = typeof entry.relation === 'string' ? entry.relation : 'row';
    const key = typeof entry.key === 'string' ? entry.key : JSON.stringify(entry.key ?? '');
    const change = typeof entry.change === 'string' ? entry.change : 'changed';
    const oldDisplay = typeof entry.old_display === 'string' ? entry.old_display : null;
    const oldProofRef = typeof entry.old_proof_iri === 'string' && entry.old_proof_iri.length > 0 ? entry.old_proof_iri : null;
    const newDisplay = typeof entry.new_display === 'string' ? entry.new_display : null;
    const newProofRef = typeof entry.new_proof_iri === 'string' && entry.new_proof_iri.length > 0 ? entry.new_proof_iri : null;

    out.push(
      Object.freeze({
        id: `${relation}::${key}::${i}`,
        relation,
        key,
        change,
        oldDisplay,
        oldHref: oldProofRef ? makePinnedHref(oldProofRef) : null,
        oldProofRef,
        newDisplay,
        newHref: newProofRef ? makePinnedHref(newProofRef) : null,
        newProofRef
      })
    );
  }
  return Object.freeze(out);
}

function parseRowStateAndSlots(
  rawKey: readonly unknown[]
): {
  readonly state: 'known' | 'unknown' | 'not_applicable' | 'absent' | 'invalid';
  readonly reason: string | null;
  readonly slots: readonly ProofMapRowSlot[];
} {
  // Rezono 4-tuple calc rows: [entity, value, state, reason]
  if (rawKey.length === 4 && typeof rawKey[2] === 'string' && VALID_STATES.has(rawKey[2])) {
    const state = rawKey[2] as 'known' | 'unknown' | 'not_applicable' | 'absent' | 'invalid';
    const entity = String(rawKey[0] ?? '');
    const rawValue = String(rawKey[1] ?? '');
    const reason = typeof rawKey[3] === 'string' && rawKey[3].length > 0 ? rawKey[3] : null;
    const slots: ProofMapRowSlot[] = [Object.freeze({ name: 'entity', display: entity })];
    if (state === 'known') {
      slots.push(Object.freeze({ name: 'value', display: rawValue }));
    } else if (reason) {
      slots.push(Object.freeze({ name: 'reason', display: reason }));
    }
    return { state, reason, slots: Object.freeze(slots) };
  }

  const slots = rawKey.map((part, idx) => Object.freeze({ name: `col_${idx}`, display: String(part ?? '') }));
  return { state: 'known', reason: null, slots: Object.freeze(slots) };
}

/**
 * Extracts served row nodes for a specific epoch (`manifestId`) from `fixture.reader_answers[role]`,
 * placed deterministically in a non-overlapping column to the right of derived relation nodes.
 */
export function extractEpochRowNodes(
  fixture: TimeFixtureLike,
  role: string,
  manifestId: string,
  colX: number,
  startY: number,
  cardW: number,
  cardH: number,
  gapY: number
): readonly ProofMapEpochRowNode[] {
  const roleMap = fixture.reader_answers?.[role];
  if (!roleMap) return Object.freeze([]);

  const marker = `/${manifestId}/rows/`;
  const rowPaths = Object.keys(roleMap)
    .filter((p) => p.includes(marker) && roleMap[p]?.status === 200)
    .sort(cmpStr);

  const out: ProofMapEpochRowNode[] = [];
  let rowY = startY;

  for (const p of rowPaths) {
    const body = roleMap[p]?.body as { readonly rows?: readonly { readonly key?: unknown }[] } | undefined;
    if (!body || !Array.isArray(body.rows)) continue;
    const relStart = p.indexOf(marker) + marker.length;
    const qIdx = p.indexOf('?', relStart);
    const relation = qIdx >= 0 ? p.slice(relStart, qIdx) : p.slice(relStart);

    for (const row of body.rows) {
      const keyArr = Array.isArray(row?.key) ? row.key : [row?.key];
      const keyJson = JSON.stringify(keyArr);
      const { state, reason, slots } = parseRowStateAndSlots(keyArr);
      const id = `${manifestId}::${relation}::${keyJson}`;
      out.push(
        Object.freeze({
          id,
          relation,
          key: keyJson,
          state,
          reason,
          slots,
          proofRef: `${manifestId}/${relation}/${keyJson}`,
          x: colX,
          y: rowY,
          w: cardW,
          h: cardH
        })
      );
      rowY += cardH + gapY;
    }
  }

  return Object.freeze(out);
}
