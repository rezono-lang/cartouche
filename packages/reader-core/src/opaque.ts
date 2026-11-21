/**
 * Decision 0001: Branded Opaque Display Cell.
 * Cartouche NEVER parses display strings into numbers or performs arithmetic on them.
 * Unknown cells strictly forbid digits and carry an explicit epistemic reason.
 */

export type EpistemicState = 'known' | 'unknown' | 'not_applicable' | 'invalid' | 'absent';

export type EpistemicSign = 'decision' | 'legislator' | 'design' | 'observation' | 'derived';

export type OpaqueText = string & { readonly __opaqueBrand: 'RezonoDisplayToken' };

export interface RawCellInput {
  readonly state: EpistemicState;
  readonly display?: string | null;
  readonly previous_display?: string | null;
  readonly reason?: string | null;
  readonly unit?: string | null;
  readonly proof_ref: string;
  readonly completeness_witness_ref?: string | null;
}

export interface OpaqueDisplayCell {
  readonly state: EpistemicState;
  readonly display: OpaqueText | null;
  readonly previousDisplay: OpaqueText | null;
  readonly reason: string | null;
  readonly proofRef: string;
  readonly completenessWitnessRef: string | null;
}

const DIGIT_RE = /\d/;

/**
 * Validates and wraps a server-projected cell into an OpaqueDisplayCell.
 * Enforces Decision 0001 invariants at the boundary:
 *  - `unknown` must NEVER carry a digit or fallback zero.
 *  - `absent` must carry a completeness witness reference.
 */
export function asOpaqueCell(raw: RawCellInput): OpaqueDisplayCell {
  if (!raw.proof_ref || raw.proof_ref.trim().length === 0) {
    throw new Error('Zero-proof mark rejected: every OpaqueDisplayCell requires a non-empty proof_ref.');
  }
  if (raw.state === 'unknown') {
    if (raw.display !== undefined && raw.display !== null) {
      throw new Error(`Epistemic violation: unknown cell (${raw.proof_ref}) must have display=null, received "${raw.display}".`);
    }
    if (!raw.reason || raw.reason.trim().length === 0) {
      throw new Error(`Epistemic violation: unknown cell (${raw.proof_ref}) requires an explicit reason.`);
    }
    if (DIGIT_RE.test(raw.reason) && /^[€$£]?\s*0([.,]0+)?$/.test(raw.reason.trim())) {
      throw new Error(`Epistemic violation: unknown cell (${raw.proof_ref}) masquerades as zero.`);
    }
  }
  if (raw.state === 'absent') {
    if (!raw.completeness_witness_ref || raw.completeness_witness_ref.trim().length === 0) {
      throw new Error(`Epistemic violation: absent cell (${raw.proof_ref}) requires a completeness_witness_ref.`);
    }
  }
  if (raw.state === 'known' && (raw.display === undefined || raw.display === null)) {
    throw new Error(`Contract violation: known cell (${raw.proof_ref}) requires a server-formatted display string.`);
  }
  return Object.freeze({
    state: raw.state,
    display: raw.display != null ? (raw.display as OpaqueText) : null,
    previousDisplay: raw.previous_display != null ? (raw.previous_display as OpaqueText) : null,
    reason: raw.reason ?? null,
    proofRef: raw.proof_ref,
    completenessWitnessRef: raw.completeness_witness_ref ?? null
  });
}

/**
 * Returns the exact opaque text for rendering without transforming, rounding, or computing.
 */
export function renderOpaqueText(cell: OpaqueDisplayCell): string {
  if (cell.state === 'unknown') return `unknown · ${cell.reason ?? 'unspecified'}`;
  if (cell.state === 'not_applicable') return '–';
  if (cell.state === 'absent') return '⦸ absent';
  if (cell.state === 'invalid') return `invalid · ${cell.reason ?? 'check_failed'}`;
  return cell.display ?? '';
}
