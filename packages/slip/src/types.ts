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
  /** Typed as Rezono's model reads it; std-explain writes `suppose: given` (a string), so `.delta` is undefined there. */
  readonly suppose?: { readonly delta?: string };
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
  readonly kind?: string;
  readonly sign?: string;
  readonly origin_sign?: string;
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
  readonly iri?: string;
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
export type ReaderHashCheckStatus = 'green' | 'warning' | 'red' | 'unavailable';
export type ReaderTrustTier = 'sealed' | 'provisional_checked' | 'provisional_engine';

export interface CheckedWitness {
  readonly conclusion: RowRef;
  readonly status: ReaderHashCheckStatus;
  readonly piece_sha256?: string | undefined;
}

export interface ReaderHashes {
  readonly status: ReaderHashCheckStatus;
  readonly checked_witnesses?: readonly CheckedWitness[] | undefined;
}

export interface HeadResponse {
  readonly id: string;
  readonly epoch: number;
  readonly knowledge_time?: string;
  readonly dataset?: string;
  readonly manifest_sha256: string;
  readonly witness_check?: WitnessCheckStatus;
  readonly trust_tier?: ReaderTrustTier;
  readonly may_propose?: boolean;
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
  readonly iri?: string;
  readonly sources?: readonly Source[];
  readonly state?: ValueState;
  readonly reason?: string;
}

export interface GroundsStep {
  readonly conclusion: RowRef;
  readonly premise: RowRef;
  readonly how: string;
  readonly position: number;
  readonly value?: string;
  readonly load_bearing?: boolean;
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
  readonly turn?: SweepTurnStatus;
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
  readonly hidden_count?: number;
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
  readonly reader_hashes?: ReaderHashes;
}

export type SweepStopStatus = 'green' | 'warning' | 'red' | 'not_computed' | 'unavailable';
export type SweepTurnStatus = 'turns' | 'same' | 'unknown';

export interface BoundSweepCellResponse {
  readonly index: number;
  readonly value: string;
  readonly status: SweepStopStatus;
  readonly checks?: readonly SweepCheckInfo[];
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

// ---- The slip's view (ported) ----

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface SweepCheckInfo {
  readonly name: string;
  readonly status: 'green' | 'warning' | 'red' | 'unavailable';
}

export interface SweepStop {
  readonly index: number;
  readonly value: string;
  readonly status: SweepStopStatus;
  readonly statusLabel: string;
  readonly turn?: SweepTurnStatus | undefined;
  readonly causes?: readonly string[] | undefined;
  readonly manifest?: string | undefined;
  readonly checks?: readonly SweepCheckInfo[] | undefined;
}

export interface LineSweep {
  readonly name: string;
  readonly stops: readonly SweepStop[];
  readonly unavailable: boolean;
  readonly unavailableNote?: string | undefined;
  readonly samplesNote: string;
}

export interface SignInfo {
  readonly name: string;
  readonly glyph: string;
  readonly label: string;
  readonly form?: string | undefined;
}

export type ValueState = 'known' | 'unknown' | 'not_applicable' | 'invalid' | 'absent';

export interface LineFold {
  readonly oldValue: string;
  readonly newValue: string;
  readonly newState: ValueState;
  readonly newReason: string;
  readonly newSign?: SignInfo | undefined;
}

export interface LineVerb {
  readonly verb: string;
  readonly label: string;
  readonly key: string;
  readonly question: string;
  readonly answerShape: string;
  readonly primary?: boolean | undefined;
}

export interface AnswerTableCell {
  readonly text: string;
  readonly sign?: SignInfo | undefined;
}

export interface AnswerBinding {
  readonly variable: string;
  readonly value: string;
  readonly line?: number | undefined;
}

export interface AnswerPremiseLink {
  readonly line: number;
  readonly label: string;
}

export interface AnswerWitnessGroup {
  readonly iri: string;
  readonly sentence?: readonly SentenceSegment[] | undefined;
  readonly bindings?: readonly AnswerBinding[] | undefined;
}

export interface AnswerTableRow {
  readonly depth?: number | undefined;
  readonly line?: number | undefined;
  readonly relation?: string | undefined;
  readonly key?: string | undefined;
  readonly polarity?: 'positive' | 'negative' | undefined;
  readonly sentence?: readonly SentenceSegment[] | undefined;
  readonly bindings?: readonly AnswerBinding[] | undefined;
  readonly witnessGroups?: readonly AnswerWitnessGroup[] | undefined;
  readonly premiseLinks?: readonly AnswerPremiseLink[] | undefined;
  readonly source?: string | undefined;
  readonly state?: ValueState | undefined;
  readonly reason?: string | undefined;
  readonly proofRef?: string | undefined;
  readonly loadBearing?: boolean | undefined;
  readonly cells: readonly AnswerTableCell[];
}

export interface AnswerTable {
  readonly question: string;
  readonly shape: string;
  readonly heading: string;
  readonly headers: readonly string[];
  readonly rows: readonly AnswerTableRow[];
  readonly cutMessage?: string | undefined;
  readonly moreLabel?: string | undefined;
  readonly hiddenCount?: number | undefined;
}

export interface RowSelection {
  readonly relation: string;
  readonly key: readonly string[];
}

export interface SentenceSegment {
  readonly text: string;
  readonly line?: number | undefined;
}

export interface SlipLine {
  index: number;
  relation: string;
  key: string;
  iri?: string | undefined;
  depth: number;
  polarity: 'positive' | 'negative';
  part?: 'total' | undefined;
  path?: string | undefined;
  label: string;
  value: string;
  state: ValueState;
  reason: string;
  valueSign?: SignInfo | undefined;
  origin: string;
  originSign?: SignInfo | undefined;
  verbs: LineVerb[];
  sweep?: LineSweep | undefined;
}

export interface SlipSeal {
  readonly manifestSha256: string;
  readonly witnessCheck?: WitnessCheckStatus | undefined;
  readonly readerHashes?: ReaderHashes | undefined;
  readonly witnessConclusions?: readonly RowRef[] | undefined;
  readonly manifestLabel: string;
  readonly readerHashesLabel: string;
  readonly sealSign?: SignInfo | undefined;
}

export interface SlipView {
  kind: 'slip' | 'relations';
  lang: string;
  pack: string;
  manifestId: string;
  /** Cartouche: the head the reader served (the seal quotes it). */
  head: HeadResponse;
  row?: RowSelection | undefined;
  sentence: SentenceSegment[];
  lines: SlipLine[];
  relations: Array<{ id: string; label: string }>;
  seal: SlipSeal;
  headers: { line: string; value: string; origin: string; verbs: string };
  legendHeaders: { title: string; sign: string; meaning: string };
  signCatalog: SignInfo[];
  supposedSign?: SignInfo | undefined;
  labels: { relationsHeading: string; closeAnswer: string };
  answersByKey: Record<string, AnswerTable>;
  /**
   * Cartouche: the folds of every variant a stop of this slip names, computed at build time from the variant's
   * published difference. Rezono's page fetched each difference in the browser (loadVariantFolds) when a stop was picked.
   */
  foldsByVariant: Record<string, Record<number, LineFold>>;
}
