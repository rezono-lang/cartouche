/**
 * Decision 0012 §3a (Requirement 5): Ghost rows for missing premises & epistemic unknown preservation.
 * - Domain-free & zero-compute: reads missing premises and unknown reasons strictly from served
 *   Rezono gate answers (`grounds` / `calc_witnesses` / `gap` / `contrast` / epoch `/rows/`).
 * - Never collapses `unknown` to `0`, `false`, `no`, or `absent`.
 * - Every ghost row sits in its source pack lane with hatched styling, zero digits, published reason,
 *   and a dashed dependency edge (`dashed: true`, `stroke-dasharray`) to its unknown conclusion.
 */

export interface ProofMapGhostNode {
  readonly id: string;
  readonly relation: string;
  readonly key: string;
  readonly lane: string;
  readonly ghost: true;
  readonly state: 'unknown';
  readonly reason: string;
  readonly proofRef: string;
  readonly targetId: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface ProofMapFocusRowNode {
  readonly id: string;
  readonly relation: string;
  readonly key: string;
  readonly lane: string;
  readonly state: 'known' | 'unknown' | 'not_applicable' | 'absent' | 'invalid';
  readonly reason: string | null;
  readonly display: string | null;
  readonly proofRef: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface ProofMapGhostProjection {
  readonly ghostNodes: readonly ProofMapGhostNode[];
  readonly focusRowNodes: readonly ProofMapFocusRowNode[];
  readonly dashedEdges: readonly { readonly from: string; readonly to: string; readonly dashed: true }[];
}

interface GroundsAnswerLike {
  readonly start?: { readonly relation?: unknown; readonly key?: unknown };
  readonly calc_witnesses?: readonly {
    readonly relation?: unknown;
    readonly key?: unknown;
    readonly state?: unknown;
    readonly reason?: unknown;
    readonly steps?: readonly { readonly relation?: unknown; readonly state?: unknown; readonly reason?: unknown }[];
  }[];
  readonly missing?: readonly { readonly relation?: unknown; readonly key?: unknown; readonly reason?: unknown }[];
}

interface GhostFixtureLike {
  readonly reader_answers?: Readonly<Record<string, unknown>>;
}

interface SourceKindRef {
  readonly id: string;
  readonly lane: string;
}

const VALID_STATES = new Set(['known', 'unknown', 'not_applicable', 'absent', 'invalid']);

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Resolves the role answer map for either `reader_answers[role]` (fixture 12)
 * or `reader_answers[store][role]` (fixture 10).
 */
export function resolveRoleAnswers(
  fixture: GhostFixtureLike,
  role: string,
  store?: string
): Readonly<Record<string, { readonly status?: unknown; readonly body?: unknown }>> | null {
  const root = fixture.reader_answers;
  if (!root || typeof root !== 'object') return null;

  if (store) {
    const storeMap = root[store];
    if (storeMap && typeof storeMap === 'object') {
      const roleMap = (storeMap as Record<string, unknown>)[role];
      if (roleMap && typeof roleMap === 'object') {
        return roleMap as Readonly<Record<string, { readonly status?: unknown; readonly body?: unknown }>>;
      }
    }
  }

  const direct = root[role];
  if (direct && typeof direct === 'object') {
    return direct as Readonly<Record<string, { readonly status?: unknown; readonly body?: unknown }>>;
  }
  return null;
}

function collectTransitiveSourceAncestors(
  startRelation: string,
  premiseSets: ReadonlyMap<string, ReadonlySet<string>>,
  sourceKindMap: ReadonlyMap<string, SourceKindRef>
): readonly SourceKindRef[] {
  const visited = new Set<string>([startRelation]);
  const queue: string[] = [startRelation];
  const found = new Map<string, SourceKindRef>();

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const prems = premiseSets.get(cur);
    if (!prems) continue;
    for (const p of prems) {
      if (visited.has(p)) continue;
      visited.add(p);
      const sk = sourceKindMap.get(p);
      if (sk) {
        found.set(sk.id, sk);
      } else {
        queue.push(p);
      }
    }
  }

  return [...found.values()].sort((a, b) => cmpStr(a.id, b.id));
}

function parseCalcKeyTuple(rawKey: readonly unknown[]): {
  readonly entity: string;
  readonly value: string;
  readonly state: 'known' | 'unknown' | 'not_applicable' | 'absent' | 'invalid';
  readonly reason: string | null;
} | null {
  if (rawKey.length === 4 && typeof rawKey[2] === 'string' && VALID_STATES.has(rawKey[2])) {
    return {
      entity: String(rawKey[0] ?? ''),
      value: String(rawKey[1] ?? ''),
      state: rawKey[2] as 'known' | 'unknown' | 'not_applicable' | 'absent' | 'invalid',
      reason: typeof rawKey[3] === 'string' && rawKey[3].length > 0 ? rawKey[3] : null
    };
  }
  return null;
}

/**
 * Projects ghost rows for missing premises and focus/selected epistemic conclusion rows
 * strictly from served gate answers (`groundsAnswer` / `selected` / epoch `/rows/`).
 */
export function buildProofMapGhosts(params: {
  readonly fixture: GhostFixtureLike;
  readonly role: string;
  readonly store?: string | undefined;
  readonly manifestId: string;
  readonly packId: string;
  readonly selected?: { readonly relation: string; readonly key: unknown } | undefined;
  readonly groundsAnswer?: unknown;
  readonly focusEntity?: string | undefined;
  readonly sourceKinds: readonly SourceKindRef[];
  readonly premiseSets: ReadonlyMap<string, ReadonlySet<string>>;
  readonly laneX: number;
  readonly derivedColX: number;
  readonly startY: number;
  readonly cardW: number;
  readonly cardH: number;
  readonly gapY: number;
}): ProofMapGhostProjection {
  const {
    fixture,
    role,
    store,
    manifestId,
    packId,
    selected,
    groundsAnswer,
    focusEntity,
    sourceKinds,
    premiseSets,
    laneX,
    derivedColX,
    startY,
    cardW,
    cardH,
    gapY
  } = params;

  const ghostNodes: ProofMapGhostNode[] = [];
  const focusRowNodes: ProofMapFocusRowNode[] = [];
  const dashedEdges: { readonly from: string; readonly to: string; readonly dashed: true }[] = [];

  const sourceKindMap = new Map(sourceKinds.map((sk) => [sk.id, sk]));
  const fallbackLane = sourceKinds[0]?.lane ?? packId;

  let ghostY = startY;
  let focusY = startY;

  // Path A: explicit selected unknown conclusion + groundsAnswer (e.g. calc_witnesses missing premise)
  if (selected && Array.isArray(selected.key)) {
    const parsed = parseCalcKeyTuple(selected.key);
    if (parsed && parsed.state === 'unknown') {
      const answer = groundsAnswer as GroundsAnswerLike | undefined;
      const reason =
        parsed.reason ??
        (typeof answer?.calc_witnesses?.[0]?.reason === 'string' && answer.calc_witnesses[0].reason.length > 0
          ? answer.calc_witnesses[0].reason
          : 'unknown');
      const keyJson = JSON.stringify(selected.key);
      const conclusionId = `focus::${manifestId}::${selected.relation}::${keyJson}`;

      focusRowNodes.push(
        Object.freeze({
          id: conclusionId,
          relation: selected.relation,
          key: keyJson,
          lane: packId,
          state: 'unknown',
          reason,
          display: null,
          proofRef: `${manifestId}/${selected.relation}/${keyJson}`,
          x: derivedColX,
          y: focusY,
          w: cardW,
          h: cardH
        })
      );
      focusY += cardH + gapY;

      const missingList = Array.isArray(answer?.missing) ? answer.missing : [];
      if (missingList.length > 0) {
        for (let i = 0; i < missingList.length; i++) {
          const item = missingList[i]!;
          const rel = typeof item.relation === 'string' ? item.relation : selected.relation;
          const mReason = typeof item.reason === 'string' && item.reason.length > 0 ? item.reason : reason;
          const lane = sourceKindMap.get(rel)?.lane ?? fallbackLane;
          const gId = `ghost::${manifestId}::${rel}::${i}`;
          ghostNodes.push(
            Object.freeze({
              id: gId,
              relation: rel,
              key: typeof item.key === 'string' ? item.key : JSON.stringify(item.key ?? [parsed.entity]),
              lane,
              ghost: true,
              state: 'unknown',
              reason: mReason,
              proofRef: `${manifestId}/ghost/${rel}/${i}`,
              targetId: conclusionId,
              x: laneX,
              y: ghostY,
              w: cardW,
              h: cardH
            })
          );
          dashedEdges.push(Object.freeze({ from: gId, to: conclusionId, dashed: true }));
          ghostY += cardH + gapY;
        }
      } else {
        const ancestors = collectTransitiveSourceAncestors(selected.relation, premiseSets, sourceKindMap);
        const targetSources = ancestors.length > 0 ? ancestors : [{ id: selected.relation, lane: fallbackLane }];
        for (let i = 0; i < targetSources.length; i++) {
          const src = targetSources[i]!;
          const gId = `ghost::${manifestId}::${src.id}::${parsed.entity}`;
          ghostNodes.push(
            Object.freeze({
              id: gId,
              relation: src.id,
              key: JSON.stringify([parsed.entity]),
              lane: src.lane,
              ghost: true,
              state: 'unknown',
              reason,
              proofRef: `${manifestId}/ghost/${src.id}/${parsed.entity}`,
              targetId: conclusionId,
              x: laneX,
              y: ghostY,
              w: cardW,
              h: cardH
            })
          );
          dashedEdges.push(Object.freeze({ from: gId, to: conclusionId, dashed: true }));
          ghostY += cardH + gapY;
        }
      }
    }
  }

  // Path B: focusEntity at a specific epoch (e.g. m-1 unknown -> m-4 known)
  if (focusEntity) {
    const roleMap = resolveRoleAnswers(fixture, role, store);
    if (roleMap) {
      const marker = `/${manifestId}/rows/`;
      const rowPaths = Object.keys(roleMap)
        .filter((p) => p.includes(marker) && roleMap[p]?.status === 200)
        .sort(cmpStr);

      for (const p of rowPaths) {
        const body = roleMap[p]?.body as { readonly rows?: readonly { readonly key?: unknown }[] } | undefined;
        if (!body || !Array.isArray(body.rows)) continue;
        const relStart = p.indexOf(marker) + marker.length;
        const qIdx = p.indexOf('?', relStart);
        const relation = qIdx >= 0 ? p.slice(relStart, qIdx) : p.slice(relStart);

        for (const row of body.rows) {
          if (!Array.isArray(row?.key)) continue;
          const parsed = parseCalcKeyTuple(row.key);
          if (!parsed || parsed.entity !== focusEntity) continue;
          const keyJson = JSON.stringify(row.key);
          const conclusionId = `focus::${manifestId}::${relation}::${keyJson}`;

          focusRowNodes.push(
            Object.freeze({
              id: conclusionId,
              relation,
              key: keyJson,
              lane: packId,
              state: parsed.state,
              reason: parsed.reason,
              display: parsed.state === 'known' ? parsed.value : null,
              proofRef: `${manifestId}/${relation}/${keyJson}`,
              x: derivedColX,
              y: focusY,
              w: cardW,
              h: cardH
            })
          );
          focusY += cardH + gapY;

          if (parsed.state === 'unknown') {
            const reason = parsed.reason ?? 'unknown';
            const ancestors = collectTransitiveSourceAncestors(relation, premiseSets, sourceKindMap);
            const missingSources = ancestors.filter((src) => {
              const srcPath = Object.keys(roleMap).find(
                (rp) => rp.includes(`${marker}${src.id}`) && roleMap[rp]?.status === 200
              );
              if (!srcPath) return true;
              const srcBody = roleMap[srcPath]?.body as { readonly rows?: readonly { readonly key?: unknown }[] } | undefined;
              if (!srcBody || !Array.isArray(srcBody.rows)) return true;
              return !srcBody.rows.some((r) => Array.isArray(r?.key) && r.key[0] === focusEntity);
            });
            const toMaterialize = missingSources.length > 0 ? missingSources : ancestors;
            for (const src of toMaterialize) {
              const gId = `ghost::${manifestId}::${src.id}::${focusEntity}`;
              ghostNodes.push(
                Object.freeze({
                  id: gId,
                  relation: src.id,
                  key: JSON.stringify([focusEntity]),
                  lane: src.lane,
                  ghost: true,
                  state: 'unknown',
                  reason,
                  proofRef: `${manifestId}/ghost/${src.id}/${focusEntity}`,
                  targetId: conclusionId,
                  x: laneX,
                  y: ghostY,
                  w: cardW,
                  h: cardH
                })
              );
              dashedEdges.push(Object.freeze({ from: gId, to: conclusionId, dashed: true }));
              ghostY += cardH + gapY;
            }
          }
        }
      }
    }
  }

  return Object.freeze({
    ghostNodes: Object.freeze(ghostNodes),
    focusRowNodes: Object.freeze(focusRowNodes),
    dashedEdges: Object.freeze(dashedEdges)
  });
}
