/**
 * Pinned Share Links (Decision 0012 §3.11 / m2-pinned-share-links).
 * Encodes only pinned conclusion IRI, time controls, selection, and optional role lens;
 * strips all session/personal parameters and enforces zero-escalation / zero-existence-leak access resolution.
 */

export interface PinnedShareUrlInput {
  readonly baseUrl: string;
  readonly at: string;
  readonly validAt?: string | null | undefined;
  readonly knownAt?: string | null | undefined;
  readonly epoch?: number | null | undefined;
  readonly selection?: string | null | undefined;
  readonly roleLens?: string | null | undefined;
  readonly [extra: string]: unknown;
}

export interface ParsedPinnedShareUrl {
  readonly at: string;
  readonly validAt?: string | undefined;
  readonly knownAt?: string | undefined;
  readonly epoch?: number | undefined;
  readonly selection?: string | undefined;
  readonly roleLens?: string | undefined;
}

export interface PinnedShareAccessContext {
  readonly recipientRole: string;
  readonly allowedRoleLenses: readonly string[];
  readonly readerStatus: number;
}

export interface PinnedShareAccessResolution {
  readonly status: 'ok' | 'not_found' | 'withdrawn';
  readonly effectiveRole: string;
  readonly roleLensNotice: boolean;
}

const UINT_RE = /^[0-9]+$/;

/**
 * Builds a deterministic pinned share URL containing only allowlisted address and view parameters.
 * Never includes session tokens, credentials, or personal data.
 */
export function buildPinnedShareUrl(input: PinnedShareUrlInput): string {
  const url = new URL(input.baseUrl);
  // Clear any pre-existing query parameters to guarantee zero leakage of ambient session/user params.
  url.search = '';
  url.searchParams.set('at', input.at);
  if (typeof input.validAt === 'string' && input.validAt.length > 0) {
    url.searchParams.set('valid_at', input.validAt);
  }
  if (typeof input.knownAt === 'string' && input.knownAt.length > 0) {
    url.searchParams.set('known_at', input.knownAt);
  }
  if (typeof input.epoch === 'number' && Number.isInteger(input.epoch) && UINT_RE.test(String(input.epoch))) {
    url.searchParams.set('epoch', String(input.epoch));
  }
  if (typeof input.selection === 'string' && input.selection.length > 0) {
    url.searchParams.set('selection', input.selection);
  }
  if (typeof input.roleLens === 'string' && input.roleLens.length > 0) {
    url.searchParams.set('role_lens', input.roleLens);
  }
  return url.toString();
}

/**
 * Parses a pinned share URL back into its allowlisted fields.
 */
export function parsePinnedShareUrl(rawUrl: string): ParsedPinnedShareUrl {
  const url = new URL(rawUrl);
  const at = url.searchParams.get('at') ?? '';
  const validAt = url.searchParams.get('valid_at') ?? undefined;
  const knownAt = url.searchParams.get('known_at') ?? undefined;
  const epochRaw = url.searchParams.get('epoch');
  const epoch = epochRaw !== null && UINT_RE.test(epochRaw) ? Number.parseInt(epochRaw, 10) : undefined;
  const selection = url.searchParams.get('selection') ?? undefined;
  const roleLens = url.searchParams.get('role_lens') ?? undefined;

  return {
    at,
    ...(validAt !== undefined ? { validAt } : {}),
    ...(knownAt !== undefined ? { knownAt } : {}),
    ...(epoch !== undefined ? { epoch } : {}),
    ...(selection !== undefined ? { selection } : {}),
    ...(roleLens !== undefined ? { roleLens } : {})
  };
}

/**
 * Resolves recipient access for a pinned share link:
 * - 403 and 404 map to the exact same `not_found` outcome (zero existence leak).
 * - 410 maps to `withdrawn`.
 * - A requested `roleLens` outside `allowedRoleLenses` never elevates privileges; it falls back
 *   to `recipientRole` and raises `roleLensNotice: true`.
 */
export function resolvePinnedShareAccess(
  share: ParsedPinnedShareUrl,
  context: PinnedShareAccessContext
): PinnedShareAccessResolution {
  if (context.readerStatus === 403 || context.readerStatus === 404) {
    return {
      status: 'not_found',
      effectiveRole: context.recipientRole,
      roleLensNotice: false
    };
  }
  if (context.readerStatus === 410) {
    return {
      status: 'withdrawn',
      effectiveRole: context.recipientRole,
      roleLensNotice: false
    };
  }
  if (share.roleLens && !context.allowedRoleLenses.includes(share.roleLens)) {
    return {
      status: 'ok',
      effectiveRole: context.recipientRole,
      roleLensNotice: true
    };
  }
  return {
    status: 'ok',
    effectiveRole: share.roleLens ?? context.recipientRole,
    roleLensNotice: false
  };
}
