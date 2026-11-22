import { SIGNS } from '../../reader-core/src/index.ts';

export type ProofMapSlotState = 'known' | 'unknown' | 'not_applicable' | 'invalid' | 'absent';

export interface ProofMapCardSlot {
  readonly name: string;
  readonly display: string;
  readonly state: ProofMapSlotState;
  readonly reason: string | null;
  readonly proofRef: string;
}

export interface ProofMapCardData {
  readonly relation: string;
  readonly key: string;
  readonly state: ProofMapSlotState;
  readonly reason: string | null;
  readonly proofRef: string;
  readonly slots: readonly ProofMapCardSlot[];
}

export interface GateRowsAnswerBody {
  readonly rows?: readonly { readonly key?: readonly unknown[] }[];
}

export interface RoleAnswerEntry {
  readonly status?: number;
  readonly body?: unknown;
}

export interface BundleColumnLike {
  readonly name?: string;
}

export interface BundleAttrLike {
  readonly name?: string;
  readonly kind?: string;
  readonly table?: string;
}

export interface BundleRelLike {
  readonly id?: string;
  readonly calc?: string;
  readonly columns?: readonly BundleColumnLike[];
}

export interface BundleForCardsLike {
  readonly attributes?: readonly BundleAttrLike[];
  readonly relations?: readonly BundleRelLike[];
}

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function resolveProofMapManifest(
  roleMap: Readonly<Record<string, RoleAnswerEntry>>,
  epochs: readonly { readonly manifest?: string }[] | undefined,
  requestedManifest?: string
): string {
  if (typeof requestedManifest === 'string' && requestedManifest.length > 0) {
    return requestedManifest;
  }
  if (Array.isArray(epochs) && epochs.length > 0) {
    const last = epochs[epochs.length - 1];
    if (typeof last?.manifest === 'string' && last.manifest.length > 0) {
      return last.manifest;
    }
  }
  const found = new Set<string>();
  for (const key of Object.keys(roleMap)) {
    const m = key.match(/^\/[^/]+\/(m-[0-9]+)\/rows\//);
    if (m && m[1]) found.add(m[1]);
  }
  const sorted = [...found].sort(cmpStr);
  return sorted.length > 0 ? sorted[sorted.length - 1]! : 'm-0';
}

export function extractFocusSubject(focusKey?: string): string | undefined {
  if (typeof focusKey !== 'string' || focusKey.length === 0) return undefined;
  const sep = focusKey.indexOf('::');
  if (sep >= 0 && sep + 2 < focusKey.length) {
    return focusKey.slice(sep + 2);
  }
  return undefined;
}

function readRecordedRows(
  roleMap: Readonly<Record<string, RoleAnswerEntry>>,
  packId: string,
  manifest: string,
  table: string
): readonly { readonly key: readonly unknown[] }[] {
  const path = `/${packId}/${manifest}/rows/${table}`;
  const entry = roleMap[path];
  if (!entry || entry.status !== 200 || !entry.body || typeof entry.body !== 'object') {
    return [];
  }
  const raw = (entry.body as GateRowsAnswerBody).rows;
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is { readonly key: readonly unknown[] } => Boolean(r && Array.isArray(r.key)));
}

function pickRow(
  rows: readonly { readonly key: readonly unknown[] }[],
  subjectCol: number,
  focusSubject?: string
): { readonly key: readonly unknown[] } | undefined {
  if (rows.length === 0) return undefined;
  if (focusSubject) {
    const exact = rows.find((r) => String(r.key[subjectCol] ?? '') === focusSubject);
    if (exact) return exact;
  }
  return rows[0];
}

function normalizeState(raw: string): ProofMapSlotState {
  if (raw === 'unknown' || raw === 'not_applicable' || raw === 'invalid' || raw === 'absent') {
    return raw;
  }
  return 'known';
}

export function buildCardDataForNode(params: {
  readonly roleMap: Readonly<Record<string, RoleAnswerEntry>>;
  readonly packId: string;
  readonly manifest: string;
  readonly relation: string;
  readonly kind: 'source' | 'derived';
  readonly qualifiedName: string;
  readonly bundle: BundleForCardsLike;
  readonly focusSubject?: string | undefined;
}): ProofMapCardData {
  const { roleMap, packId, manifest, relation, kind, qualifiedName, bundle, focusSubject } = params;
  const fallbackProofRef = `${packId}/bundle#${relation}`;

  if (kind === 'derived') {
    const relEntry = (bundle.relations ?? []).find((r) => r.id === relation);
    const cols = relEntry?.columns ?? [];
    const colIndex = new Map<string, number>();
    cols.forEach((c, idx) => {
      if (typeof c.name === 'string') colIndex.set(c.name, idx);
    });

    const rows = readRecordedRows(roleMap, packId, manifest, relation);
    const subjectCol = colIndex.get('subject') ?? 0;
    const row = pickRow(rows, subjectCol, focusSubject);

    if (row && colIndex.has('value') && colIndex.has('state')) {
      const valueCol = colIndex.get('value')!;
      const stateCol = colIndex.get('state')!;
      const reasonCol = colIndex.get('reason');
      const rowKey = String(row.key[subjectCol] ?? relation);
      const state = normalizeState(String(row.key[stateCol] ?? 'known'));
      const rawValue = String(row.key[valueCol] ?? '');
      const rawReason = reasonCol !== undefined ? String(row.key[reasonCol] ?? '') : '';
      const reason = state === 'known' ? null : rawReason || state;
      const display =
        state === 'unknown'
          ? (SIGNS.unknown?.glyph ?? '▨')
          : state === 'not_applicable'
            ? (SIGNS.not_applicable?.glyph ?? '–')
            : state === 'invalid'
              ? (SIGNS.invalid?.glyph ?? '!')
              : state === 'absent'
                ? (SIGNS.absent?.glyph ?? '⦸')
                : rawValue;
      const proofRef = `${manifest}/${relation}/${JSON.stringify(row.key)}`;
      const slotName = typeof relEntry?.calc === 'string' && relEntry.calc.length > 0 ? relEntry.calc : relation;
      return Object.freeze({
        relation,
        key: rowKey,
        state,
        reason,
        proofRef,
        slots: Object.freeze([
          Object.freeze({ name: slotName, display, state, reason, proofRef })
        ])
      });
    }

    if (row) {
      const rowKey = String(row.key[0] ?? relation);
      const proofRef = `${manifest}/${relation}/${JSON.stringify(row.key)}`;
      const slots: ProofMapCardSlot[] = row.key.map((val, idx) =>
        Object.freeze({
          name: typeof cols[idx]?.name === 'string' ? cols[idx]!.name! : `col_${idx}`,
          display: String(val ?? ''),
          state: 'known' as const,
          reason: null,
          proofRef
        })
      );
      return Object.freeze({
        relation,
        key: rowKey,
        state: 'known',
        reason: null,
        proofRef,
        slots: Object.freeze(
          slots.length > 0
            ? slots
            : [Object.freeze({ name: 'key', display: rowKey, state: 'known', reason: null, proofRef })]
        )
      });
    }

    return Object.freeze({
      relation,
      key: relation,
      state: 'known',
      reason: null,
      proofRef: fallbackProofRef,
      slots: Object.freeze([
        Object.freeze({ name: 'relation', display: qualifiedName, state: 'known', reason: null, proofRef: fallbackProofRef })
      ])
    });
  }

  // Source kind node: literal attribute values live inside the row card, never as separate nodes.
  const kindRows = readRecordedRows(roleMap, packId, manifest, relation);
  const kindRow = pickRow(kindRows, 0, focusSubject);
  const rowKey = kindRow ? String(kindRow.key[0] ?? relation) : relation;
  const proofRef = kindRow ? `${manifest}/${relation}/${JSON.stringify(kindRow.key)}` : fallbackProofRef;

  const slots: ProofMapCardSlot[] = [];
  const attrs = [...(bundle.attributes ?? [])]
    .filter((a) => a.kind === relation && typeof a.table === 'string' && a.table.length > 0)
    .sort((a, b) => cmpStr(a.table ?? '', b.table ?? ''));

  for (const attr of attrs) {
    const table = attr.table!;
    const attrRows = readRecordedRows(roleMap, packId, manifest, table);
    const attrRow = pickRow(attrRows, 0, rowKey !== relation ? rowKey : focusSubject);
    if (!attrRow) continue;
    const attrProofRef = `${manifest}/${table}/${JSON.stringify(attrRow.key)}`;
    const slotName = typeof attr.name === 'string' && attr.name.length > 0 ? attr.name : table;
    const display = String(attrRow.key[1] ?? attrRow.key[0] ?? '');
    slots.push(
      Object.freeze({
        name: slotName,
        display,
        state: 'known',
        reason: null,
        proofRef: attrProofRef
      })
    );
  }

  if (slots.length === 0) {
    slots.push(
      Object.freeze({
        name: 'id',
        display: rowKey,
        state: 'known',
        reason: null,
        proofRef
      })
    );
  }

  return Object.freeze({
    relation,
    key: rowKey,
    state: 'known',
    reason: null,
    proofRef,
    slots: Object.freeze(slots)
  });
}

export function cardHeightForSlots(slotCount: number): number {
  const visibleCount = slotCount > 0 ? slotCount : 1;
  return 38 + visibleCount * 16;
}

export function renderCardSlotsSvg(
  x: number,
  y: number,
  slots: readonly {
    readonly name: string;
    readonly display: string;
    readonly state?: string | undefined;
    readonly reason?: string | null | undefined;
    readonly proofRef?: string | undefined;
  }[],
  fallbackProofRef?: string
): string {
  return slots
    .map((slot, idx) => {
      const sy = y + 48 + idx * 16;
      const state = slot.state ?? 'known';
      const reasonAttr = slot.reason ? ` data-reason="${escapeXml(slot.reason)}"` : '';
      const proofRef = slot.proofRef ?? fallbackProofRef ?? '';
      const proofAttr = proofRef ? ` data-proof-ref="${escapeXml(proofRef)}"` : '';
      const text =
        state === 'unknown'
          ? `${SIGNS.unknown?.glyph ?? '▨'} ${slot.reason ?? ''}`.trim()
          : `${slot.name}: ${slot.display}`;
      return (
        `<g data-state="${escapeXml(state)}"${reasonAttr}${proofAttr}>` +
        `<text x="${x + 10}" y="${sy}" fill="var(--c-ink-soft)" font-size="10">${escapeXml(text)}</text>` +
        `</g>`
      );
    })
    .join('');
}
