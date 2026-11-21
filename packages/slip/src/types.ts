/**
 * Types of the slip's view model (Decision 0009), ported from rezono-lang/rezono viewer/slip/src/types.ts at
 * f15c89d665e2815b02e12665203a9d48dd6abc40. Rezono imports its contract shapes from generated files that are not
 * committed (contracts/typescript/generated/); the few fields the model reads are declared here structurally, as the
 * reader serves them (contracts/proof.yaml, bundle.yaml, explain.yaml, manifest.yaml at that commit).
 */

// ---- Contract shapes the model reads (structural) ----

export interface RowRef {
  readonly relation: string;
  readonly key: string;
}

export interface MessageResource {
  readonly lang: string;
  readonly resource: string;
}

export interface Label {
  readonly element: string;
  readonly lang: string;
  readonly text: string;
}

export interface QuestionStep {
  readonly trace?: unknown;
  readonly suppose?: string | { readonly delta?: string };
}

export interface Question {
  readonly term: string;
  readonly start: string;
  readonly answer: string;
  readonly steps: readonly QuestionStep[];
}

export interface Rule {
  readonly id: string;
  readonly message?: string;
  readonly body?: readonly unknown[];
}

export interface Source {
  readonly name: string;
  readonly position?: string;
}

export interface Snapshot {
  readonly relation: string;
  readonly role?: string;
  readonly complete?: boolean;
  readonly full?: boolean;
  readonly format?: string;
}

export interface Binding {
  readonly variable: string;
  readonly value: string;
}

export interface Witness {
  readonly conclusion: RowRef;
  readonly rule_id: string;
  readonly bindings?: readonly Binding[];
  readonly aggregates?: readonly unknown[];
}

export interface CalcStep {
  readonly path: string;
  readonly op: string;
  readonly ref?: string;
  readonly relation?: string;
  readonly value?: string;
  readonly state: string;
  readonly reason?: string;
  readonly element?: string;
}

export interface CalcWitness {
  readonly conclusion: RowRef;
  readonly rule: string;
  readonly value?: string;
  readonly state: string;
  readonly reason?: string;
  readonly premises?: readonly RowRef[];
  readonly steps?: readonly CalcStep[];
}

// ---- Reader answers (ported) ----

export type WitnessCheckStatus = 'green' | 'warning' | 'red';

export interface HeadResponse {
  readonly id: string;
  readonly epoch: number;
  readonly knowledge_time?: string;
  readonly manifest_sha256: string;
  readonly witness_check?: WitnessCheckStatus;
  readonly snapshots: readonly Snapshot[];
}

export interface RoleSlot {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly table: string;
}

export interface RoleRelation {
  readonly id: string;
  readonly calc?: string;
}

export interface RoleKind {
  readonly id: string;
  readonly parent?: string;
}

export interface RoleBundleResponse {
  readonly pack: { readonly id: string };
  readonly kinds: readonly RoleKind[];
  readonly attributes: readonly RoleSlot[];
  readonly arrows: readonly RoleSlot[];
  readonly relations: readonly RoleRelation[];
  readonly rules: readonly Rule[];
  readonly labels: readonly Label[];
  readonly messages: readonly MessageResource[];
  readonly home: { readonly claim: readonly string[] };
  readonly questions: readonly Question[];
}

export interface GroundsNode extends RowRef {
  readonly distance: number;
  readonly outside?: boolean;
  readonly sources?: readonly Source[];
}

export interface GroundsStep {
  readonly conclusion: RowRef;
  readonly premise: RowRef;
  readonly how: string;
  readonly position: number;
  readonly value?: string;
}

export interface GapPremiseLike {
  readonly distance: number;
  readonly node: RowRef;
  readonly rule: string;
  readonly kind: string;
  readonly relation?: string;
}

export interface GapCandidateLike {
  readonly change: string;
  readonly relation: string;
  readonly key: string;
  readonly premise: number;
}

export interface DifferenceEntry {
  readonly relation: string;
  readonly key: string;
  readonly change: string;
  readonly was?: string;
}

export interface DifferenceCount {
  readonly relation: string;
  readonly added: number;
  readonly removed: number;
  readonly changed: number;
}

export interface SeriesCell {
  readonly index: number;
  readonly value: string;
  readonly status: string;
  readonly turn?: string;
  readonly causes?: readonly string[];
  readonly counts?: readonly DifferenceCount[];
}

export interface ExplainAnswer {
  readonly question: string;
  readonly manifest_id?: string;
  readonly start?: RowRef;
  readonly nodes: readonly GroundsNode[];
  readonly steps?: readonly GroundsStep[];
  readonly witnesses?: readonly Witness[];
  readonly calc_witnesses?: readonly CalcWitness[];
  readonly next?: string;
  readonly more?: readonly RowRef[];
  readonly gap?: {
    readonly premises: readonly GapPremiseLike[];
    readonly candidates?: readonly GapCandidateLike[];
    readonly cut: boolean;
  };
  readonly difference?: {
    readonly counts?: readonly DifferenceCount[];
    readonly entries?: readonly DifferenceEntry[];
  };
  readonly series?: readonly SeriesCell[];
}

export type SweepStopStatus = 'green' | 'warning' | 'red' | 'not_computed' | 'unavailable';
export type SweepTurnStatus = 'turns' | 'same' | 'unknown';

export interface BoundSweepCellResponse {
  readonly index: number;
  readonly value: string;
  readonly status: string;
  readonly checks?: readonly { readonly name: string; readonly status: string }[];
  readonly manifest?: string;
}

export interface BoundSweepResponse {
  readonly name: string;
  readonly cell: { readonly kind: string; readonly id: string; readonly slot: string };
  readonly cells: readonly BoundSweepCellResponse[];
}

export interface BoundSweepListResponse {
  readonly manifest_id: string;
  readonly sweeps: readonly BoundSweepResponse[];
}

// ---- std packs and the message filler, read from Rezono at the pinned commit ----

export interface StdVerb {
  readonly verb: string;
  readonly label_message: string;
  readonly key: string;
  readonly question?: string;
  readonly primary?: boolean;
}

export interface StdSign {
  readonly sign: string;
  readonly form: string;
  readonly glyph?: string;
  readonly label_message: string;
}

export interface StdStatus {
  readonly status: string;
  readonly tone: string;
  readonly glyph?: string;
  readonly label_message: string;
}

export interface StdPacks {
  readonly viewMessages: readonly MessageResource[];
  readonly explainMessages: readonly MessageResource[];
  readonly verbs: readonly StdVerb[];
  readonly signs: readonly StdSign[];
  readonly statuses: readonly StdStatus[];
}

export type MessageArgs = Readonly<Record<string, string | number | boolean | undefined>>;

export type MessagePart = { readonly kind: 'text'; readonly text: string } | { readonly kind: 'var'; readonly name: string; readonly text: string };

/** viewer/messages/src/fill.ts, consumed at the pinned commit (packages/slip/bin/rezono-source.ts). */
export interface MessageFiller {
  readonly fill: (resources: readonly MessageResource[], lang: string, id: string, args?: MessageArgs) => string | undefined;
  readonly fillParts: (
    resources: readonly MessageResource[],
    lang: string,
    id: string,
    args?: MessageArgs
  ) => readonly MessagePart[] | undefined;
}

/** One reader route: a path asked, the status and JSON body answered. */
export type ReaderHandler = (request: Request) => Promise<Response>;
