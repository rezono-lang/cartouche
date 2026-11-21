/**
 * Decision 0003: Headless @rezono/slip state controller.
 * Houses the 6 keyboard verbs (w d m s c p), compact 5-bar micro-prism,
 * [M] Certainty Levers, [S] Δ=1 Adjacent World hops, and automatic Propose lock on unsealed streams.
 */

import type { CartoucheSeal } from '../../reader-core/src/index.ts';

export type VerbKey = 'w' | 'd' | 'm' | 's' | 'c' | 'p';

export interface PrismSpectrum {
  readonly key: 'norm' | 'observed' | 'fog' | 'cliff' | 'role';
  readonly label: string;
  readonly ratio_display: string;
  readonly bar_units: number;
  readonly state: string;
}

export interface MissingLever {
  readonly id: string;
  readonly label: string;
  readonly unblocks: readonly string[];
  readonly redundant: boolean;
}

export interface AdjacentWorldHop {
  readonly id: string;
  readonly sector: 'repair' | 'certainty' | 'cliff';
  readonly label: string;
  readonly outcome_display: string;
  readonly proof_ref: string;
}

export interface SlipModel {
  readonly subjectId: string;
  readonly proofRef: string | null;
  readonly activeVerb: VerbKey;
  readonly proposeAllowed: boolean;
  readonly proposeBlockedReason: string | null;
  readonly prism5: readonly PrismSpectrum[];
  readonly missingLevers: readonly MissingLever[];
  readonly adjacentWorlds: readonly AdjacentWorldHop[];
}

export function createSlipModel(input: {
  readonly subjectId: string;
  readonly proofRef?: string | null;
  readonly seal: CartoucheSeal;
  readonly activeVerb?: VerbKey;
  readonly prism5: readonly PrismSpectrum[];
  readonly missingLevers: readonly MissingLever[];
  readonly adjacentWorlds: readonly AdjacentWorldHop[];
}): SlipModel {
  if (input.prism5.length !== 5) {
    throw new Error(`Epistemic Prism requires exactly 5 spectra, received ${input.prism5.length}.`);
  }
  const proposeAllowed = input.seal.canPropose;
  const proposeBlockedReason = proposeAllowed
    ? null
    : input.seal.trustTier === 'provisional_engine'
      ? 'propose_locked_unsealed_live_stream'
      : 'propose_locked_witness_failed';

  return Object.freeze({
    subjectId: input.subjectId,
    proofRef: input.proofRef ?? null,
    activeVerb: input.activeVerb ?? 'w',
    proposeAllowed,
    proposeBlockedReason,
    prism5: Object.freeze([...input.prism5]),
    missingLevers: Object.freeze([...input.missingLevers]),
    adjacentWorlds: Object.freeze([...input.adjacentWorlds])
  });
}

export function selectSlipVerb(model: SlipModel, verb: VerbKey): SlipModel {
  return Object.freeze({ ...model, activeVerb: verb });
}
