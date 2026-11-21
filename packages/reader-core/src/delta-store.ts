/**
 * Two-layer Z-set (+1 / -1) DeltaStore with 3-tier Cartouche Trust Seal.
 * Lesson from Plan.md & Decision 0003:
 *  - A full publication is simply one +1 batch over an empty sealed layer.
 *  - Live <250ms deltas enter the provisional layer (tier: `provisional_engine`),
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
   * Ingest a complete server-sealed round snapshot published by Rezono (Decision 0011).
   * Only Rezono seals a round; the client never promotes provisional rows to sealed.
   */
  ingestSealedSnapshot(nextManifest: ManifestMeta, sealedRows: readonly T[]): void {
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
    const canPropose = this.#manifest.witness_check === 'green' && activeTier !== 'provisional_engine';
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
