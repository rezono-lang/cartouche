/**
 * Deterministic Key Page view model (Decision 0012 §3 (10)).
 * Lists all role-readable conclusions about one entity key from recorded Rezono reader answers,
 * grouped by relation, linked to pinned slips, with honest partial-read horizon notice,
 * verbatim reader-served derivation path steps, and distance-1-only neighbours.
 * Zero client compute: no graph search, no hidden-row counting, no domain words.
 */

export interface RecordedReaderAnswer {
  readonly status: number;
  readonly body: unknown;
}

export interface KeyPageFixtureInput {
  readonly reader_answers?: Readonly<
    Record<string, Readonly<Record<string, Readonly<Record<string, RecordedReaderAnswer>>>>>
  >;
}

export interface KeyPagePathStepInput {
  readonly depth: number;
  readonly relation: string;
  readonly key: string;
  readonly display: string;
  readonly proof_ref: string;
}

export interface KeyPageInput {
  readonly fixture: KeyPageFixtureInput;
  readonly store?: string | undefined;
  readonly role?: string | undefined;
  readonly entityKey: string;
  readonly validAt?: string | undefined;
  readonly knownAt?: string | undefined;
  readonly pathSteps?: readonly KeyPagePathStepInput[] | undefined;
}

export interface KeyPageConclusion {
  readonly relation: string;
  readonly key: string;
  readonly display: string;
  readonly proofRef: string;
  readonly slipHref: string;
}

export interface KeyPageGroup {
  readonly relation: string;
  readonly items: readonly KeyPageConclusion[];
}

export interface KeyPageNeighbour {
  readonly relation: string;
  readonly key: string;
  readonly label: string;
  readonly depth: 1;
  readonly proofRef: string;
  readonly x: number;
  readonly y: number;
  readonly boxY: number;
  readonly textX: number;
  readonly textY: number;
}

export interface KeyPageModel {
  readonly entityKey: string;
  readonly store: string;
  readonly role: string;
  readonly manifestId: string;
  readonly trustTier: string | null;
  readonly validAt: string | null;
  readonly knownAt: string | null;
  readonly notReadInFull: boolean;
  readonly groups: readonly KeyPageGroup[];
  readonly pathSteps: readonly KeyPagePathStepInput[];
  readonly neighbours: readonly KeyPageNeighbour[];
  readonly svgWidth: number;
  readonly svgHeight: number;
  readonly centerY: number;
  readonly centerBoxY: number;
  readonly centerTextY: number;
}

interface GroundsNodeLike {
  readonly relation?: unknown;
  readonly key?: unknown;
  readonly distance?: unknown;
  readonly outside?: unknown;
}

interface WitnessLike {
  readonly conclusion?: { readonly relation?: unknown; readonly key?: unknown };
  readonly iri?: unknown;
}

interface GroundsBodyLike {
  readonly start?: { readonly relation?: unknown; readonly key?: unknown };
  readonly nodes?: readonly GroundsNodeLike[];
  readonly witnesses?: readonly WitnessLike[];
}

interface HeadBodyLike {
  readonly id?: unknown;
  readonly trust_tier?: unknown;
  readonly snapshots?: readonly { readonly relation?: unknown; readonly full?: unknown }[];
}

function parseKeyParts(rawKey: string): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(rawKey);
    if (Array.isArray(parsed) && parsed.every((p) => typeof p === 'string')) {
      return parsed as string[];
    }
  } catch {
    // Fall back to raw key string
  }
  return [rawKey];
}

function buildSlipHref(proofRef: string, validAt: string | null, knownAt: string | null): string {
  const params = new URLSearchParams();
  params.set('at', proofRef);
  if (validAt) params.set('valid_at', validAt);
  if (knownAt) params.set('known_at', knownAt);
  return `?${params.toString()}`;
}

export function buildKeyPageModel(input: KeyPageInput): KeyPageModel {
  const store = input.store ?? 'main';
  const role = input.role ?? 'reader';
  const validAt = input.validAt ?? null;
  const knownAt = input.knownAt ?? null;
  const answers = input.fixture.reader_answers?.[store]?.[role];
  if (!answers) {
    throw new Error(`buildKeyPageModel: no recorded reader answers for store "${store}", role "${role}".`);
  }

  const headEntry = Object.entries(answers).find(([p]) => p.endsWith('/head'));
  const head = (headEntry?.[1]?.body ?? {}) as HeadBodyLike;
  const manifestId = typeof head.id === 'string' ? head.id : '';
  const trustTier =
    head.trust_tier === 'sealed' ||
    head.trust_tier === 'provisional_checked' ||
    head.trust_tier === 'provisional_engine'
      ? head.trust_tier
      : null;

  const snapshots = Array.isArray(head.snapshots) ? head.snapshots : [];
  const notReadInFull = snapshots.some((s) => s.full === false);

  const conclusionMap = new Map<string, KeyPageConclusion>();
  const neighbourMap = new Map<string, { relation: string; key: string; proofRef: string }>();

  const answerPaths = Object.keys(answers).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const answerPath of answerPaths) {
    if (!answerPath.includes('/ask/grounds?')) continue;
    const rec = answers[answerPath];
    if (!rec || rec.status !== 200 || !rec.body || typeof rec.body !== 'object') continue;
    const body = rec.body as GroundsBodyLike;
    const witnessIriByRow = new Map<string, string>();
    for (const w of body.witnesses ?? []) {
      const c = w.conclusion;
      if (c && typeof c.relation === 'string' && typeof c.key === 'string' && typeof w.iri === 'string') {
        const rowId = `${c.relation}\u0000${c.key}`;
        if (!witnessIriByRow.has(rowId)) witnessIriByRow.set(rowId, w.iri);
      }
    }

    const start = body.start;
    const startMatchesEntity =
      start !== undefined &&
      typeof start.relation === 'string' &&
      typeof start.key === 'string' &&
      parseKeyParts(start.key).includes(input.entityKey);

    for (const node of body.nodes ?? []) {
      if (node.outside === true) continue;
      if (typeof node.relation !== 'string' || typeof node.key !== 'string') continue;
      const parts = parseKeyParts(node.key);
      const rowId = `${node.relation}\u0000${node.key}`;
      const proofRef = witnessIriByRow.get(rowId) ?? manifestId;

      if (parts.includes(input.entityKey) && !conclusionMap.has(rowId)) {
        conclusionMap.set(rowId, {
          relation: node.relation,
          key: node.key,
          display: parts.join(' · '),
          proofRef,
          slipHref: buildSlipHref(proofRef, validAt, knownAt)
        });
      }

      if (startMatchesEntity && node.distance === 1 && !neighbourMap.has(rowId)) {
        neighbourMap.set(rowId, {
          relation: node.relation,
          key: node.key,
          proofRef
        });
      }
    }
  }

  const byRelation = new Map<string, KeyPageConclusion[]>();
  const sortedConclusionKeys = [...conclusionMap.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const k of sortedConclusionKeys) {
    const item = conclusionMap.get(k)!;
    const bucket = byRelation.get(item.relation);
    if (bucket) bucket.push(item);
    else byRelation.set(item.relation, [item]);
  }

  const groups: KeyPageGroup[] = [...byRelation.keys()]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((relation) => ({
      relation,
      items: byRelation.get(relation)!
    }));

  const sortedNeighbourKeys = [...neighbourMap.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const neighbours: KeyPageNeighbour[] = sortedNeighbourKeys.map((k, idx) => {
    const entry = neighbourMap.get(k)!;
    const parts = parseKeyParts(entry.key);
    const y = 44 + idx * 40;
    return {
      relation: entry.relation,
      key: entry.key,
      label: `${entry.relation}: ${parts.join(' · ')}`,
      depth: 1 as const,
      proofRef: entry.proofRef,
      x: 340,
      y,
      boxY: y - 14,
      textX: 350,
      textY: y + 4
    };
  });

  const svgWidth = 640;
  const svgHeight = Math.max(120, 64 + neighbours.length * 40);
  const centerY = svgHeight / 2;

  return Object.freeze({
    entityKey: input.entityKey,
    store,
    role,
    manifestId,
    trustTier,
    validAt,
    knownAt,
    notReadInFull,
    groups,
    pathSteps: input.pathSteps ? [...input.pathSteps] : [],
    neighbours,
    svgWidth,
    svgHeight,
    centerY,
    centerBoxY: centerY - 16,
    centerTextY: centerY + 4
  });
}
