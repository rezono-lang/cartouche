import { escapeXml } from './flow-split-svg.ts';

export interface ProofMapSelectionTarget {
  readonly relation: string;
  readonly key: string | readonly unknown[];
}

export interface ProofMapGroundsNodeLike {
  readonly relation?: string;
  readonly key?: string | readonly unknown[];
  readonly distance?: number;
  readonly sources?: readonly { readonly kind?: string; readonly name?: string; readonly position?: string }[];
}

export interface ProofMapWitnessLike {
  readonly iri?: string;
  readonly premises?: readonly { readonly relation?: string; readonly key?: string | readonly unknown[] }[];
}

export interface ProofMapGroundsAnswerLike {
  readonly manifest_id?: string;
  readonly start?: { readonly relation?: string; readonly key?: string | readonly unknown[] };
  readonly nodes?: readonly ProofMapGroundsNodeLike[];
  readonly witnesses?: readonly ProofMapWitnessLike[];
}

export interface ProofMapWitnessHighlightNode {
  readonly id: string;
  readonly relation: string;
  readonly keyJson: string;
  readonly distance: number;
  readonly proofRef: string;
  readonly sources: readonly string[];
}

export interface ProofMapWitnessProjection {
  readonly highlightedNodes: readonly ProofMapWitnessHighlightNode[];
  readonly highlightedIds: ReadonlySet<string>;
  readonly activeWitnessIri: string | null;
  readonly slipHtml: string;
}

export function canonicalWitnessKeyJson(key: string | readonly unknown[]): string {
  if (typeof key === 'string') {
    const trimmed = key.trim();
    if (trimmed.startsWith('[')) return trimmed;
    return JSON.stringify([key]);
  }
  return JSON.stringify(key);
}

export function canonicalWitnessRowId(relation: string, key: string | readonly unknown[]): string {
  return `${relation}::${canonicalWitnessKeyJson(key)}`;
}

export function lookupRecordedGroundsAnswer(
  roleMap: Readonly<Record<string, { readonly status?: unknown; readonly body?: unknown }>>,
  packId: string,
  manifestId: string,
  selected: ProofMapSelectionTarget
): ProofMapGroundsAnswerLike | undefined {
  const keyJson = canonicalWitnessKeyJson(selected.key);
  const encodedKey = encodeURIComponent(keyJson);
  const exactPath = `/${packId}/${manifestId}/ask/grounds?relation=${encodeURIComponent(selected.relation)}&key=${encodedKey}`;
  const exact = roleMap[exactPath];
  if (exact && exact.status === 200 && exact.body && typeof exact.body === 'object') {
    return exact.body as ProofMapGroundsAnswerLike;
  }
  const suffix = `/ask/grounds?relation=${encodeURIComponent(selected.relation)}&key=${encodedKey}`;
  for (const pathKey of Object.keys(roleMap).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (pathKey.endsWith(suffix)) {
      const entry = roleMap[pathKey];
      if (entry && entry.status === 200 && entry.body && typeof entry.body === 'object') {
        return entry.body as ProofMapGroundsAnswerLike;
      }
    }
  }
  return undefined;
}

function formatSources(
  sources: readonly { readonly kind?: string; readonly name?: string; readonly position?: string }[] | undefined
): readonly string[] {
  if (!Array.isArray(sources)) return Object.freeze([]);
  return Object.freeze(
    sources
      .map((s) => {
        const name = typeof s?.name === 'string' ? s.name : '';
        const pos = typeof s?.position === 'string' ? s.position : '';
        return pos ? `${name}#${pos}` : name;
      })
      .filter((s) => s.length > 0)
  );
}

function parseKeyDisplayParts(keyJson: string): string {
  try {
    const parsed = JSON.parse(keyJson);
    if (Array.isArray(parsed)) {
      return parsed.map((v) => String(v ?? '')).filter((s) => s.length > 0).join(' · ');
    }
    return String(parsed ?? '');
  } catch {
    return keyJson;
  }
}

export function buildProofMapWitnessProjection(params: {
  readonly manifestId: string;
  readonly selected: ProofMapSelectionTarget;
  readonly groundsAnswer?: ProofMapGroundsAnswerLike | undefined;
  readonly witnessIndex?: number | undefined;
  readonly fallbackPremises?: readonly { readonly relation: string; readonly keyJson: string; readonly proofRef: string }[];
}): ProofMapWitnessProjection {
  const { manifestId, selected, groundsAnswer, witnessIndex, fallbackPremises = [] } = params;
  const activeManifest =
    typeof groundsAnswer?.manifest_id === 'string' && groundsAnswer.manifest_id.length > 0
      ? groundsAnswer.manifest_id
      : manifestId;

  const witnesses = Array.isArray(groundsAnswer?.witnesses) ? groundsAnswer.witnesses : [];
  const requestedIndex = typeof witnessIndex === 'number' ? witnessIndex : 0;
  const boundedIndex =
    witnesses.length > 0 ? Math.max(0, Math.min(requestedIndex, witnesses.length - 1)) : 0;
  const activeWitness = witnesses.length > 0 ? witnesses[boundedIndex] : undefined;
  const activeWitnessIri =
    typeof activeWitness?.iri === 'string' && activeWitness.iri.length > 0 ? activeWitness.iri : null;

  const byId = new Map<string, ProofMapWitnessHighlightNode>();

  const addNode = (
    relation: string,
    key: string | readonly unknown[],
    distance: number,
    sources?: readonly { readonly kind?: string; readonly name?: string; readonly position?: string }[]
  ): void => {
    const keyJson = canonicalWitnessKeyJson(key);
    const id = `${relation}::${keyJson}`;
    if (byId.has(id)) return;
    const proofRef =
      distance === 0 && activeWitnessIri
        ? activeWitnessIri
        : `${activeManifest}/${relation}/${keyJson}`;
    byId.set(
      id,
      Object.freeze({
        id,
        relation,
        keyJson,
        distance,
        proofRef,
        sources: formatSources(sources)
      })
    );
  };

  if (typeof witnessIndex === 'number' && witnesses.length > 1 && activeWitness && Array.isArray(activeWitness.premises)) {
    const startRel =
      typeof groundsAnswer?.start?.relation === 'string' ? groundsAnswer.start.relation : selected.relation;
    const startKey = groundsAnswer?.start?.key ?? selected.key;
    addNode(startRel, startKey, 0);

    const nodeSourceMap = new Map<string, readonly { readonly kind?: string; readonly name?: string; readonly position?: string }[]>();
    for (const n of groundsAnswer?.nodes ?? []) {
      if (typeof n.relation === 'string' && n.key !== undefined) {
        nodeSourceMap.set(canonicalWitnessRowId(n.relation, n.key), n.sources ?? []);
      }
    }

    for (const p of activeWitness.premises) {
      if (typeof p.relation === 'string' && p.key !== undefined) {
        const pid = canonicalWitnessRowId(p.relation, p.key);
        addNode(p.relation, p.key, 1, nodeSourceMap.get(pid));
      }
    }
  } else if (Array.isArray(groundsAnswer?.nodes) && groundsAnswer.nodes.length > 0) {
    for (const n of groundsAnswer.nodes) {
      if (typeof n.relation === 'string' && n.key !== undefined) {
        addNode(n.relation, n.key, typeof n.distance === 'number' ? n.distance : 0, n.sources);
      }
    }
  } else {
    addNode(selected.relation, selected.key, 0);
    for (const fp of fallbackPremises) {
      const id = `${fp.relation}::${fp.keyJson}`;
      if (!byId.has(id)) {
        byId.set(
          id,
          Object.freeze({
            id,
            relation: fp.relation,
            keyJson: fp.keyJson,
            distance: 1,
            proofRef: fp.proofRef,
            sources: Object.freeze([])
          })
        );
      }
    }
  }

  const highlightedNodes = Object.freeze([...byId.values()]);
  const highlightedIds = new Set(highlightedNodes.map((n) => n.id));

  const selectedKeyJson = canonicalWitnessKeyJson(selected.key);
  const sentenceText = `${selected.relation}: ${parseKeyDisplayParts(selectedKeyJson)}`;

  const rowsHtml = highlightedNodes
    .map((n) => {
      const sourceText = n.sources.length > 0 ? `@ ${n.sources.join(', ')}` : n.proofRef;
      return (
        `<tr data-relation="${escapeXml(n.relation)}" data-key="${escapeXml(n.keyJson)}" data-depth="${n.distance}" data-proof-ref="${escapeXml(n.proofRef)}">` +
        `<td>${escapeXml(n.relation)}</td>` +
        `<td>${escapeXml(parseKeyDisplayParts(n.keyJson))}</td>` +
        `<td><a href="#${escapeXml(n.proofRef)}" data-proof-ref="${escapeXml(n.proofRef)}">${escapeXml(sourceText)}</a></td>` +
        `</tr>`
      );
    })
    .join('');

  const witnessRowHtml = activeWitnessIri
    ? `<tr data-proof-ref="${escapeXml(activeWitnessIri)}"><td>witness</td><td colspan="2"><a href="${escapeXml(activeWitnessIri)}" data-proof-ref="${escapeXml(activeWitnessIri)}">${escapeXml(activeWitnessIri)}</a></td></tr>`
    : '';

  const slipHtml =
    `<aside aria-label="Proof slip">` +
    `<div data-part="sentence">${escapeXml(sentenceText)}</div>` +
    `<table data-sheet="slip" aria-label="${escapeXml(selected.relation)}">` +
    `<thead><tr><th scope="col">Relation</th><th scope="col">Bindings</th><th scope="col">Source</th></tr></thead>` +
    `<tbody>${rowsHtml}${witnessRowHtml}</tbody>` +
    `</table>` +
    `</aside>`;

  return Object.freeze({
    highlightedNodes,
    highlightedIds,
    activeWitnessIri,
    slipHtml
  });
}
