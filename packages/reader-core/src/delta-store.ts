/**
 * Two-layer Z-set (+1 / -1) DeltaStore with 3-tier Cartouche Trust Seal.
 * Lesson from Plan.md & Decision 0003:
 *  - A full publication is simply one +1 batch over an empty sealed layer.
 *  - Live unsealed deltas enter the provisional layer (tier: `provisional_engine`),
 *    physically locking `canPropose = false` until sealed by a verified round!
 */

export type TrustTier = 'sealed' | 'provisional_checked' | 'provisional_engine';

export interface ManifestMeta {
  readonly id: string;
  readonly epoch: number;
  readonly knowledge_time: string;
  readonly role: string;
  readonly witness_check: 'green' | 'failed';
  readonly trust_tier: TrustTier;
  readonly may_propose?: boolean;
  readonly can_propose?: boolean;
  readonly rights?: { readonly can_propose?: boolean };
}

/** Shape served by Rezono's reader on /{pack}/head (rezono-lang/rezono#1451). */
export interface ReaderHeadSealInput {
  readonly id: string;
  readonly epoch: number;
  readonly knowledge_time?: string | undefined;
  readonly manifest_sha256: string;
  readonly witness_check?: 'green' | 'warning' | 'red' | undefined;
  readonly trust_tier?: TrustTier | undefined;
  readonly may_propose?: boolean | undefined;
}

const SHA256_RE = /^[0-9a-f]{64}$/;
const READER_SERVED_MANIFESTS = new WeakSet<ManifestMeta>();

/**
 * Construct a reader-attested ManifestMeta from a Rezono /head response (Decision 0015 / #46 point 7).
 * Only manifests constructed here are accepted by DeltaStore.ingestSealedSnapshot; caller-built
 * ManifestMeta objects with trust_tier "sealed" are refused.
 */
export function manifestFromReaderHead(head: ReaderHeadSealInput, role: string): ManifestMeta {
  if (typeof head.id !== 'string' || head.id.length === 0) {
    throw new Error('manifestFromReaderHead: head.id must be a non-empty string.');
  }
  if (!Number.isInteger(head.epoch)) {
    throw new Error('manifestFromReaderHead: head.epoch must be an integer.');
  }
  if (typeof head.manifest_sha256 !== 'string' || !SHA256_RE.test(head.manifest_sha256)) {
    throw new Error('manifestFromReaderHead: head.manifest_sha256 must be a 64-character lowercase hex digest.');
  }
  if (
    head.trust_tier !== 'sealed' &&
    head.trust_tier !== 'provisional_checked' &&
    head.trust_tier !== 'provisional_engine'
  ) {
    throw new Error(`manifestFromReaderHead: head.trust_tier is missing or invalid ("${String(head.trust_tier)}").`);
  }
  const meta: ManifestMeta = Object.freeze({
    id: head.id,
    epoch: head.epoch,
    knowledge_time: head.knowledge_time ?? '',
    role,
    witness_check: head.witness_check === 'green' ? 'green' : 'failed',
    trust_tier: head.trust_tier,
    may_propose: head.may_propose === true
  });
  READER_SERVED_MANIFESTS.add(meta);
  return meta;
}

export interface ZSetChange<T extends { readonly key: string }> {
  readonly weight: 1 | -1;
  readonly row: T;
}

export interface CartoucheSeal {
  readonly manifestId: string;
  readonly epoch: number;
  readonly knowledgeTime: string;
  readonly role: string;
  readonly witnessCheck: 'green' | 'failed';
  readonly trustTier: TrustTier;
  readonly provisionalCount: number;
  readonly canPropose: boolean;
}

export class DeltaStore<T extends { readonly key: string }> {
  #sealed = new Map<string, T>();
  /** Provisional delta layer: `T` is a +1 addition/update, `null` is a -1 retraction of a sealed key. */
  #provisional = new Map<string, T | null>();
  #manifest: ManifestMeta;
  #provisionalTier: 'provisional_checked' | 'provisional_engine' | null = null;

  constructor(manifest: ManifestMeta, initialSealedRows: readonly T[] = []) {
    this.#manifest = manifest;
    for (const row of initialSealedRows) {
      this.#sealed.set(row.key, row);
    }
  }

  applySealedStep(nextManifest: ManifestMeta, changes: readonly ZSetChange<T>[]): void {
    for (const ch of changes) {
      if (ch.weight === 1) this.#sealed.set(ch.row.key, ch.row);
      else if (ch.weight === -1) this.#sealed.delete(ch.row.key);
      else throw new Error(`DeltaStore: unsupported Z-set weight ${String(ch.weight)} for key "${ch.row.key}".`);
    }
    this.#manifest = nextManifest;
    this.#provisional.clear();
    this.#provisionalTier = null;
  }

  /**
   * Ingest a complete server-sealed round snapshot published by Rezono (Decision 0011 & 0015 / #46 point 7).
   * Only Rezono seals a round; caller-built ManifestMeta objects with trust_tier "sealed" are refused.
   */
  ingestSealedSnapshot(nextManifest: ManifestMeta, sealedRows: readonly T[]): void {
    if (!READER_SERVED_MANIFESTS.has(nextManifest)) {
      throw new Error(
        'DeltaStore.ingestSealedSnapshot requires a reader-served sealed manifest (via manifestFromReaderHead); caller-built ManifestMeta is refused.'
      );
    }
    if (nextManifest.trust_tier !== 'sealed') {
      throw new Error(
        `DeltaStore.ingestSealedSnapshot requires a server-sealed manifest (trust_tier="sealed"), received "${nextManifest.trust_tier}".`
      );
    }
    this.#sealed.clear();
    for (const row of sealedRows) {
      this.#sealed.set(row.key, row);
    }
    this.#manifest = nextManifest;
    this.#provisional.clear();
    this.#provisionalTier = null;
  }

  applyProvisionalStep(
    tier: 'provisional_checked' | 'provisional_engine',
    changes: readonly ZSetChange<T>[]
  ): void {
    for (const ch of changes) {
      if (ch.weight === 1) {
        this.#provisional.set(ch.row.key, ch.row);
      } else if (ch.weight === -1) {
        if (this.#sealed.has(ch.row.key)) {
          this.#provisional.set(ch.row.key, null);
        } else {
          this.#provisional.delete(ch.row.key);
        }
      } else {
        throw new Error(`DeltaStore: unsupported Z-set weight ${String(ch.weight)} for key "${ch.row.key}".`);
      }
    }
    // Unsealed engine stream strictly dominates checked supposition tier.
    if (this.#provisionalTier !== 'provisional_engine') {
      this.#provisionalTier = tier;
    }
  }

  clearProvisional(): void {
    this.#provisional.clear();
    this.#provisionalTier = null;
  }

  rows(): readonly { readonly row: T; readonly layer: 'sealed' | 'provisional' }[] {
    const merged = new Map<string, { readonly row: T; readonly layer: 'sealed' | 'provisional' }>();
    for (const [k, row] of this.#sealed.entries()) {
      merged.set(k, { row, layer: 'sealed' });
    }
    for (const [k, row] of this.#provisional.entries()) {
      if (row === null) merged.delete(k);
      else merged.set(k, { row, layer: 'provisional' });
    }
    return [...merged.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, entry]) => entry);
  }

  seal(): CartoucheSeal {
    const provCount = this.#provisional.size;
    const activeTier: TrustTier = provCount > 0 && this.#provisionalTier
      ? this.#provisionalTier
      : this.#manifest.trust_tier;
    // Decision 0014 & 0015: never derive canPropose=true client-side when the reader omits may_propose.
    const readerGrant = this.#manifest.may_propose ?? this.#manifest.can_propose ?? this.#manifest.rights?.can_propose;
    const canPropose =
      readerGrant === true &&
      this.#manifest.witness_check === 'green' &&
      activeTier !== 'provisional_engine';
    return Object.freeze({
      manifestId: this.#manifest.id,
      epoch: this.#manifest.epoch,
      knowledgeTime: this.#manifest.knowledge_time,
      role: this.#manifest.role,
      witnessCheck: this.#manifest.witness_check,
      trustTier: activeTier,
      provisionalCount: provCount,
      canPropose
    });
  }
}
