/**
 * Proof Map Pinned Share Links (Decision 0012 §3a Requirement 11 / m2-proof-map-shareable).
 * Extends `buildPinnedShareUrl` / `parsePinnedShareUrl` from `@rezono/reader-core` with active
 * map `expansions`, strictly stripping ambient session/personal parameters and enforcing
 * zero-escalation access resolution via `resolvePinnedShareAccess`.
 */

import {
  buildPinnedShareUrl,
  parsePinnedShareUrl,
  resolvePinnedShareAccess
} from '../../reader-core/src/index.ts';
import type {
  ParsedPinnedShareUrl,
  PinnedShareAccessContext,
  PinnedShareAccessResolution,
  PinnedShareUrlInput
} from '../../reader-core/src/index.ts';

export interface ProofMapShareUrlInput extends PinnedShareUrlInput {
  readonly expansions?: readonly string[] | null | undefined;
}

export interface ParsedProofMapShareUrl extends ParsedPinnedShareUrl {
  readonly expansions?: readonly string[] | undefined;
}

export interface ProofMapShareResolution extends PinnedShareAccessResolution {
  readonly parsed: ParsedProofMapShareUrl;
}

/**
 * Builds a deterministic proof-map share URL containing only allowlisted address, time, selection,
 * role-lens, and expansion parameters. Strips all session tokens and personal data.
 */
export function buildProofMapShareUrl(input: ProofMapShareUrlInput): string {
  const base = buildPinnedShareUrl(input);
  const url = new URL(base);
  if (Array.isArray(input.expansions) && input.expansions.length > 0) {
    const clean = input.expansions.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
    if (clean.length > 0) {
      url.searchParams.set('expansions', clean.join(','));
    }
  }
  return url.toString();
}

/**
 * Parses a proof-map share URL back into its allowlisted fields, including `expansions`.
 */
export function parseProofMapShareUrl(rawUrl: string): ParsedProofMapShareUrl {
  const base = parsePinnedShareUrl(rawUrl);
  const url = new URL(rawUrl);
  const expRaw = url.searchParams.get('expansions');
  const expansions = expRaw
    ? expRaw.split(',').map((item) => item.trim()).filter((item) => item.length > 0)
    : undefined;
  return {
    ...base,
    ...(expansions && expansions.length > 0 ? { expansions } : {})
  };
}

/**
 * Parses a proof-map share URL and resolves recipient access without privilege escalation.
 */
export function resolveProofMapShareState(
  rawUrl: string,
  context: PinnedShareAccessContext
): ProofMapShareResolution {
  const parsed = parseProofMapShareUrl(rawUrl);
  const access = resolvePinnedShareAccess(parsed, context);
  return { ...access, parsed };
}
