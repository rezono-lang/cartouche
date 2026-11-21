/**
 * Deterministic Proof Map ego-graph model (Decision 0012 §8 & §3a).
 * Opens strictly as a distance-1 ego graph around `focusKey` and grows only on explicit
 * `why` / `depends` / `affects` expansions from served fixture data.
 * Group chips quote reader-published counts verbatim (zero client counting, zero domain words).
 */

export type ProofMapExpansion = 'why' | 'depends' | 'affects';

export interface ProofMapOptions {
  readonly focusKey: string;
  readonly expansions?: readonly ProofMapExpansion[] | undefined;
  readonly groupThreshold?: number | undefined;
  readonly publishedGroupCounts?: Readonly<Record<string, string>> | undefined;
  readonly validAt?: string | undefined;
  readonly knownAt?: string | undefined;
}

export interface ProofMapNode {
  readonly id: string;
  readonly key: string;
  readonly relation: string;
  readonly label: string;
  readonly distance: number;
  readonly proofRef: string;
  readonly slipHref: string;
  readonly focusHref: string;
  readonly x: number;
  readonly y: number;
  readonly boxY: number;
  readonly textX: number;
  readonly textY: number;
  readonly proofTextY: number;
}

export interface ProofMapGroupChip {
  readonly kind: string;
  readonly countDisplay: string;
}

export interface ProofMapModel {
  readonly focusKey: string;
  readonly manifestId: string;
  readonly trustTier: string | null;
  readonly expansions: readonly ProofMapExpansion[];
  readonly groupThreshold: number;
  readonly groups: readonly ProofMapGroupChip[];
  readonly nodes: readonly ProofMapNode[];
  readonly svgWidth: number;
  readonly svgHeight: number;
}

interface GateFixtureLike {
  readonly manifest?: {
    readonly id?: unknown;
    readonly trust_tier?: unknown;
  };
  readonly epochs?: readonly {
    readonly manifest?: unknown;
    readonly relation?: unknown;
  }[];
  readonly reader_answers?: Readonly<Record<string, unknown>>;
}

interface RawRowLike {
  readonly key?: unknown;
}

interface RawRowsBodyLike {
  readonly rows?: readonly RawRowLike[];
}

function makeSlipHref(proofRef: string, validAt?: string, knownAt?: string): string {
  const params = new URLSearchParams();
  params.set('at', proofRef);
  if (validAt) params.set('valid_at', validAt);
  if (knownAt) params.set('known_at', knownAt);
  return `?${params.toString()}`;
}

function makeFocusHref(focusId: string): string {
  const params = new URLSearchParams();
  params.set('focus', focusId);
  return `?${params.toString()}`;
}

function collectRowAnswers(readerAnswers: Readonly<Record<string, unknown>> | undefined): {
  readonly path: string;
  readonly rows: readonly RawRowLike[];
}[] {
  if (!readerAnswers) return [];
  const out: { readonly path: string; readonly rows: readonly RawRowLike[] }[] = [];
  const walk = (obj: Readonly<Record<string, unknown>>) => {
    for (const key of Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
      const val = obj[key];
      if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
      const rec = val as Record<string, unknown>;
      if (key.includes('/rows/') && rec.status === 200 && rec.body && typeof rec.body === 'object') {
        const body = rec.body as RawRowsBodyLike;
        if (Array.isArray(body.rows)) {
          out.push({ path: key, rows: body.rows });
        }
      } else {
        walk(rec);
      }
    }
  };
  walk(readerAnswers);
  return out;
}

function relationFromRowsPath(rowsPath: string): string {
  const idx = rowsPath.indexOf('/rows/');
  if (idx < 0) return 'row';
  const rest = rowsPath.slice(idx + '/rows/'.length);
  const q = rest.indexOf('?');
  return q >= 0 ? rest.slice(0, q) : rest;
}

function manifestFromRowsPath(rowsPath: string, fallback: string): string {
  const parts = rowsPath.split('/').filter(Boolean);
  return parts.length >= 2 ? parts[1]! : fallback;
}

export function buildProofMapModel(fixture: GateFixtureLike, options: ProofMapOptions): ProofMapModel {
  const manifestId = typeof fixture.manifest?.id === 'string' ? fixture.manifest.id : 'm-0';
  const rawTier = fixture.manifest?.trust_tier;
  const trustTier =
    rawTier === 'sealed' || rawTier === 'provisional_checked' || rawTier === 'provisional_engine'
      ? rawTier
      : null;
  const expansions: readonly ProofMapExpansion[] = options.expansions ? [...options.expansions] : [];
  const expanded = expansions.length > 0;
  const groupThreshold = options.groupThreshold ?? 8;

  const rawNodes: {
    readonly id: string;
    readonly key: string;
    readonly relation: string;
    readonly label: string;
    readonly distance: number;
    readonly proofRef: string;
  }[] = [
    {
      id: options.focusKey,
      key: options.focusKey,
      relation: 'focus',
      label: options.focusKey,
      distance: 0,
      proofRef: manifestId
    }
  ];

  const seen = new Set<string>([options.focusKey]);
  const rowAnswers = collectRowAnswers(fixture.reader_answers);
  const latestRowsEntry = rowAnswers.length > 0 ? rowAnswers[rowAnswers.length - 1] : undefined;

  if (latestRowsEntry) {
    const rel = relationFromRowsPath(latestRowsEntry.path);
    const epManifest = manifestFromRowsPath(latestRowsEntry.path, manifestId);
    for (const row of latestRowsEntry.rows) {
      if (!Array.isArray(row.key) || !row.key.every((p) => typeof p === 'string')) continue;
      const keyParts = row.key as string[];
      const id = `${epManifest}:${rel}:${keyParts[0] ?? ''}`;
      if (seen.has(id)) continue;
      seen.add(id);
      rawNodes.push({
        id,
        key: JSON.stringify(keyParts),
        relation: rel,
        label: `${rel}: ${keyParts[0] ?? ''}`,
        distance: 1,
        proofRef: epManifest
      });
    }
  }

  if (expanded && rowAnswers.length > 1) {
    for (let i = 0; i < rowAnswers.length - 1; i++) {
      const entry = rowAnswers[i]!;
      const rel = relationFromRowsPath(entry.path);
      const epManifest = manifestFromRowsPath(entry.path, manifestId);
      for (const row of entry.rows) {
        if (!Array.isArray(row.key) || !row.key.every((p) => typeof p === 'string')) continue;
        const keyParts = row.key as string[];
        const id = `${epManifest}:${rel}:${keyParts[0] ?? ''}`;
        if (seen.has(id)) continue;
        seen.add(id);
        rawNodes.push({
          id,
          key: JSON.stringify(keyParts),
          relation: rel,
          label: `${epManifest} · ${rel}: ${keyParts[0] ?? ''}`,
          distance: 2,
          proofRef: epManifest
        });
      }
    }
  }

  const rowCounters = new Map<number, number>();
  const nodes: ProofMapNode[] = rawNodes.map((n) => {
    const colIdx = rowCounters.get(n.distance) ?? 0;
    rowCounters.set(n.distance, colIdx + 1);
    const x = n.distance === 0 ? 24 : n.distance === 1 ? 284 : 544;
    const y = 44 + colIdx * 56;
    return {
      ...n,
      slipHref: makeSlipHref(n.proofRef, options.validAt, options.knownAt),
      focusHref: makeFocusHref(n.id),
      x,
      y,
      boxY: y - 16,
      textX: x + 10,
      textY: y,
      proofTextY: y + 16
    };
  });

  const groups: ProofMapGroupChip[] = Object.keys(options.publishedGroupCounts ?? {})
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((kind) => ({
      kind,
      countDisplay: options.publishedGroupCounts![kind]!
    }));

  const maxColRows = Math.max(1, ...rowCounters.values());
  const svgWidth = expanded ? 820 : 560;
  const svgHeight = Math.max(160, 64 + maxColRows * 56);

  return Object.freeze({
    focusKey: options.focusKey,
    manifestId,
    trustTier,
    expansions,
    groupThreshold,
    groups,
    nodes,
    svgWidth,
    svgHeight
  });
}
