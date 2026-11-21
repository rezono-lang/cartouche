#!/usr/bin/env node
/**
 * Deterministic @rezono/slip render harness (Decision 0006).
 * Accepts a JSON request ({ store | fixture, role, pack, lang, row?, keys?, reader?, theme?, model?, seal?, selectedStop? })
 * and returns { html, files } where `files` maps every built @rezono/slip asset to its LF-normalized SHA-256 digest.
 *
 * Reading Rezono's reader (Decision 0009): a fixture with `reader_answers` (fixtures/10-slip-reader-answers.json)
 * holds what Rezono's reader answered, per store and role. `store` names the recorded store ("main" by default),
 * `row` is { relation, key } as in Rezono's slip tests, `keys` are Rezono's line actions ({ line, key } presses a
 * verb's key on the line with that index, { line, stop } moves its sweep control to a stop) or shortcut letters,
 * and `reader` may be the path of a module whose default export wraps the reader's handler (Rezono's tests use
 * one to answer one more question). The view model (src/model.ts, ported from Rezono) runs here, at build time;
 * the page gets only its result.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Component } from 'svelte';
import { compile } from 'svelte/compiler';
import { render as svelteRender } from 'svelte/server';
import { STD_VERBS, canonicalJson } from '../../reader-core/src/index.ts';
import type { CartoucheSeal, ManifestMeta, PaletteName, RawCellInput, TrustTier } from '../../reader-core/src/index.ts';
import { createSlipModel, selectSlipVerb } from '../src/slip-controller.ts';
import type { AdjacentWorldHop, MissingLever, PrismSpectrum, SlipModel, VerbKey } from '../src/slip-controller.ts';
import { resolveSlipShortcut } from '../src/slip-element.ts';
import type { SealCheckItem, SlipSealInput, UnservedInfo } from '../src/slip-element.ts';
import { buildAnswerTable, mergeLineAnsweredVerbs, resolveLineVerbs, resolveReaderExtraVerbs } from '../src/slip-verbs.ts';
import { loadSlip } from '../src/model.ts';
import { slipPropsFromView } from '../src/slip-props.ts';
import type { SlipProps, SlipPropsSweep } from '../src/slip-props.ts';
import type { HeadResponse, MessageResource, ReaderHandler, RowSelection } from '../src/types.ts';
import { rezonoMessageFiller, rezonoStdPacks } from './rezono-source.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SLIP_SRC_DIR = path.resolve(HERE, '..', 'src');
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const CACHE_DIR = path.join(REPO_ROOT, 'node_modules', '.cache', 'cartouche-svelte-ssr');

interface SentenceBinding {
  readonly name: string;
  readonly display: string;
  readonly premise_position?: number;
  readonly aggregate?: boolean;
}

interface SlipGroundLine {
  readonly part?: 'total';
  readonly relation: string;
  readonly key: readonly string[];
  readonly polarity: 'positive' | 'negative';
  readonly depth: number;
  readonly premise_position?: number;
  readonly sign: string;
  readonly cell: RawCellInput;
  readonly answered_verbs?: readonly string[];
  /** Fixture 09 only: the sweep whose cell this line holds (the reader path finds it from the bundle). */
  readonly sweep_name?: string;
}

interface CalcStepLine {
  readonly path: string;
  readonly depth: number;
  readonly sign: string;
  readonly cell: RawCellInput;
  readonly kind?: 'step' | 'constant';
}

interface ConformanceRowPayload {
  readonly kind: 'rule' | 'calc';
  readonly rule_id: string;
  readonly sentence?: readonly { readonly text: string; readonly line?: number | undefined }[];
  readonly sentence_template?: string;
  readonly bindings?: readonly SentenceBinding[];
  readonly grounds_distance_1?: readonly SlipGroundLine[];
  readonly result_cell?: RawCellInput;
  readonly steps?: readonly CalcStepLine[];
}

interface SweepStopCheck {
  readonly id: string;
  readonly status: 'green' | 'warning' | 'red';
}

interface SweepStopPayload {
  readonly index: number;
  readonly display: string;
  readonly status: 'green' | 'warning' | 'red' | 'not_computed' | 'unavailable';
  readonly turn: 'turns' | 'same' | 'unknown' | null;
  readonly fold_display: string | null;
  readonly checks?: readonly SweepStopCheck[];
}

interface SweepPayload {
  readonly target_relation: string;
  readonly target_key: readonly string[];
  /** Role-projected stops published by Rezono for the publication's single role. */
  readonly stops?: readonly SweepStopPayload[];
  readonly stops_reader?: readonly SweepStopPayload[];
  readonly stops_summary?: readonly SweepStopPayload[];
}

interface SlipConformancePayload {
  readonly pack?: string;
  readonly home_claim?: {
    readonly relation: string;
    readonly key: readonly string[];
  };
  readonly messages?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly rows?: Readonly<Record<string, ConformanceRowPayload>>;
  readonly sweeps?: Readonly<Record<string, SweepPayload>>;
}

interface SlipFixturePayload {
  readonly fixture_id?: string;
  readonly http_status?: number;
  readonly unserved?: UnservedInfo;
  readonly manifest?: ManifestMeta;
  readonly seal_checks?: readonly SealCheckItem[];
  readonly horizon?: { readonly complete: boolean; readonly reason: string | null };
  readonly slip_enrichment?: {
    readonly prism_5: readonly PrismSpectrum[];
    readonly missing_levers: readonly MissingLever[];
    readonly adjacent_worlds_delta1: readonly AdjacentWorldHop[];
  };
  readonly slip_conformance?: SlipConformancePayload;
  /** What Rezono's reader answered: store -> role -> request path -> { status, body }. */
  readonly reader_answers?: Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, RecordedAnswer>>>>>>;
}

interface RecordedAnswer {
  readonly status: number;
  readonly body: unknown;
}

/** A key pressed on the line with this index, or that line's sweep control moved to a stop (Rezono's slip tests). */
export interface SlipLineAction {
  readonly line: number;
  readonly key?: string;
  readonly stop?: number;
}

export interface AnswerTableRow {
  readonly cells: readonly string[];
  readonly proof_ref?: string;
  readonly sign?: string;
}

export interface AnswerTableSpec {
  readonly question: string;
  readonly verb: string;
  readonly headers: readonly string[];
  readonly rows: readonly AnswerTableRow[];
}

export interface ReaderCapabilityConfig {
  readonly answeredQuestions?: readonly string[];
  readonly answeredVerbs?: readonly string[];
  readonly answersByQuestion?: Readonly<Record<string, AnswerTableSpec>>;
  readonly refuse?: UnservedInfo;
}

export interface SlipRenderRequest {
  readonly fixture?: string | SlipFixturePayload;
  readonly store?: SlipFixturePayload | string;
  readonly role?: string;
  readonly pack?: string;
  readonly lang?: string;
  readonly theme?: PaletteName;
  readonly row?: string | RowSelection;
  readonly keys?: readonly (string | SlipLineAction)[];
  readonly reader?: ReaderCapabilityConfig | string;
  readonly activeVerb?: VerbKey;
  readonly selectedStop?: number | null;
  readonly model?: SlipModel | null;
}

export interface SlipRenderResponse {
  readonly html: string;
  readonly files: Readonly<Record<string, string>>;
}

function sha256Lf(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

function preprocessTsScript(source: string): string {
  return source.replace(
    /<script\b([^>]*)lang=["']ts["']([^>]*)>([\s\S]*?)<\/script>/gi,
    (_m: string, a: string, b: string, code: string) => {
      const stripped = stripTypeScriptTypes(code, { mode: 'strip' });
      return `<script${a}${b}>${stripped}</script>`;
    }
  );
}

interface CompiledSlipBundle {
  readonly moduleFile: string;
  readonly compiledCode: string;
}

function compileSvelteFile(svelteFilePath: string): CompiledSlipBundle {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const absPath = path.resolve(svelteFilePath);
  const raw = fs.readFileSync(absPath, 'utf8');
  const preprocessed = preprocessTsScript(raw);
  const compiled = compile(preprocessed, {
    filename: absPath,
    generate: 'server',
    css: 'injected'
  });
  const sourceDir = path.dirname(absPath);
  const rewritten = compiled.js.code.replace(
    /(from\s+['"])(\.[^'"]+)(['"])/g,
    (_m: string, pre: string, spec: string, post: string) => {
      const resolved = path.resolve(sourceDir, spec);
      const target = resolved.endsWith('.svelte') ? compileSvelteFile(resolved).moduleFile : resolved;
      return `${pre}${pathToFileURL(target).href}${post}`;
    }
  );
  const digest = sha256Lf(rewritten).slice(0, 16);
  const outFile = path.join(CACHE_DIR, `${path.basename(absPath, '.svelte')}-${digest}.mjs`);
  if (!fs.existsSync(outFile)) {
    fs.writeFileSync(outFile, rewritten, 'utf8');
  }
  return { moduleFile: outFile, compiledCode: compiled.js.code };
}

function buildFilesHashMap(compiledSlipCode: string): Readonly<Record<string, string>> {
  const assetEntries: readonly [string, string][] = [
    ['packages/slip/src/SignMark.svelte', fs.readFileSync(path.join(SLIP_SRC_DIR, 'SignMark.svelte'), 'utf8')],
    ['packages/slip/src/Slip.svelte', fs.readFileSync(path.join(SLIP_SRC_DIR, 'Slip.svelte'), 'utf8')],
    ['packages/slip/src/SlipSeal.svelte', fs.readFileSync(path.join(SLIP_SRC_DIR, 'SlipSeal.svelte'), 'utf8')],
    ['packages/slip/src/SlipUnserved.svelte', fs.readFileSync(path.join(SLIP_SRC_DIR, 'SlipUnserved.svelte'), 'utf8')],
    ['packages/slip/src/SlipSweep.svelte', fs.readFileSync(path.join(SLIP_SRC_DIR, 'SlipSweep.svelte'), 'utf8')],
    ['packages/slip/src/slip-sweep.ts', fs.readFileSync(path.join(SLIP_SRC_DIR, 'slip-sweep.ts'), 'utf8')],
    ['packages/slip/src/SlipValueCell.svelte', fs.readFileSync(path.join(SLIP_SRC_DIR, 'SlipValueCell.svelte'), 'utf8')],
    ['packages/slip/src/slip-controller.ts', fs.readFileSync(path.join(SLIP_SRC_DIR, 'slip-controller.ts'), 'utf8')],
    ['packages/slip/src/slip-element.ts', fs.readFileSync(path.join(SLIP_SRC_DIR, 'slip-element.ts'), 'utf8')],
    ['packages/slip/src/slip-verbs.ts', fs.readFileSync(path.join(SLIP_SRC_DIR, 'slip-verbs.ts'), 'utf8')],
    ['packages/slip/dist/Slip.ssr.mjs', compiledSlipCode]
  ];
  const sortedNames = assetEntries.map(([name]) => name).sort();
  const byName = new Map(assetEntries);
  const map: Record<string, string> = {};
  for (const name of sortedNames) {
    const content = byName.get(name);
    if (content !== undefined) {
      map[name] = sha256Lf(content);
    }
  }
  return Object.freeze(map);
}

function loadPayload(request: SlipRenderRequest): SlipFixturePayload | null {
  if (request.store && typeof request.store !== 'string') return request.store;
  if (!request.fixture) return null;
  if (typeof request.fixture !== 'string') return request.fixture;

  const candidates = [
    path.resolve(process.cwd(), request.fixture),
    path.resolve(REPO_ROOT, request.fixture),
    path.resolve(REPO_ROOT, 'fixtures', request.fixture),
    path.resolve(REPO_ROOT, 'fixtures', `${request.fixture}.json`)
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return JSON.parse(fs.readFileSync(candidate, 'utf8')) as SlipFixturePayload;
    }
  }
  throw new Error(`Unable to locate fixture: ${request.fixture}`);
}

function sealFromManifest(manifest: ManifestMeta): CartoucheSeal {
  const canPropose = manifest.witness_check === 'green' && manifest.trust_tier !== 'provisional_engine';
  return Object.freeze({
    manifestId: manifest.id,
    epoch: manifest.epoch,
    knowledgeTime: manifest.knowledge_time,
    role: manifest.role,
    witnessCheck: manifest.witness_check,
    trustTier: manifest.trust_tier,
    provisionalCount: manifest.trust_tier === 'sealed' ? 0 : 1,
    canPropose
  });
}

const VALID_TRUST_TIERS = new Set<TrustTier>(['sealed', 'provisional_checked', 'provisional_engine']);

interface ReaderHeadWithSeal extends HeadResponse {
  readonly trust_tier?: TrustTier;
  readonly can_propose?: boolean;
  readonly provisional_count?: number;
  readonly rights?: { readonly can_propose?: boolean };
  readonly seal?: {
    readonly trust_tier?: TrustTier;
    readonly can_propose?: boolean;
    readonly provisional_count?: number;
  };
}

/**
 * Derive the Slip seal strictly from what Rezono's reader published in /head (Decision 0011):
 * - NEVER hard-code `trustTier: 'sealed'` when the reader omitted `trust_tier`.
 * - NEVER derive `canPropose` from `witness_check === 'green'` alone; require an explicit reader grant.
 */
function sealFromReaderHead(head: ReaderHeadWithSeal, role: string): SlipSealInput {
  const green = head.witness_check === 'green';
  const rawTier = head.trust_tier ?? head.seal?.trust_tier;
  if (rawTier !== undefined && !VALID_TRUST_TIERS.has(rawTier)) {
    throw new Error(`reader head: unknown trust_tier "${String(rawTier)}"`);
  }
  const readerGrant = head.can_propose ?? head.rights?.can_propose ?? head.seal?.can_propose;
  const canPropose = readerGrant === true && green && rawTier !== 'provisional_engine';
  const provisionalCount = head.provisional_count ?? head.seal?.provisional_count ?? 0;
  return Object.freeze({
    manifestId: head.id,
    epoch: head.epoch,
    knowledgeTime: head.knowledge_time ?? '',
    role,
    witnessCheck: green ? 'green' : 'failed',
    ...(rawTier !== undefined ? { trustTier: rawTier } : {}),
    provisionalCount,
    canPropose
  });
}

/** The recorded answers of one store and role as a reader handler; a request that was not recorded is an error. */
function recordedReader(answers: Readonly<Record<string, RecordedAnswer>>): ReaderHandler {
  return async (request: Request) => {
    const url = new URL(request.url);
    const recorded = answers[url.pathname + url.search];
    if (!recorded) throw new Error(`reader answers: ${url.pathname + url.search} was not recorded`);
    return Response.json(recorded.body, { status: recorded.status });
  };
}

/** Fixture 09's messages as MF2 resources, for Rezono's message filler (no `{$x}` substitution anywhere else). */
function mf2Resources(messages: Readonly<Record<string, Readonly<Record<string, string>>>> | undefined): MessageResource[] {
  return Object.entries(messages ?? {}).map(([lang, entries]) => ({
    lang,
    resource: `@locale ${lang}\n---\n${Object.entries(entries)
      .map(([id, pattern]) => `${id} = ${pattern}`)
      .join('\n')}\n`
  }));
}

/** Fixture 09's sentence, filled by Rezono's fill.ts; a variable links to the line its binding names. */
async function fixtureSentence(
  row: ConformanceRowPayload,
  messages: SlipConformancePayload['messages'],
  lang: string
): Promise<readonly { text: string; line?: number }[]> {
  if (row.kind !== 'rule') return [];
  const filler = await rezonoMessageFiller();
  const args: Record<string, string> = {};
  for (const binding of row.bindings ?? []) args[binding.name] = binding.display;
  const resources = mf2Resources(messages);
  const parts = filler.fillParts(resources, lang, row.rule_id, args) ?? filler.fillParts(resources, 'en', row.rule_id, args);
  if (parts === undefined) return [{ text: row.rule_id }];
  const grounds = row.grounds_distance_1 ?? [];
  return parts.map((part) => {
    if (part.kind !== 'var') return { text: part.text };
    const binding = (row.bindings ?? []).find((b) => b.name === part.name);
    let line = -1;
    if (binding?.aggregate === true) line = grounds.findIndex((g) => g.part === 'total');
    else if (binding?.premise_position !== undefined) {
      line = grounds.findIndex((g) => g.premise_position === binding.premise_position);
    }
    return line >= 0 ? { text: part.text, line } : { text: part.text };
  });
}

/** Fixture 09's stops on the line that holds the swept cell (pre-projected by Rezono; zero client role projection). */
function fixtureSweeps(
  grounds: readonly SlipGroundLine[],
  sweeps: SlipConformancePayload['sweeps']
): SlipPropsSweep[] {
  const out: SlipPropsSweep[] = [];
  grounds.forEach((line, idx) => {
    const sweep = line.sweep_name ? sweeps?.[line.sweep_name] : undefined;
    if (!sweep || !line.sweep_name) return;
    const name = line.sweep_name;
    const stops = sweep.stops ?? sweep.stops_reader ?? [];
    out.push({
      line: idx,
      name,
      unavailable: stops.length > 0 && stops.every((stop) => stop.status === 'unavailable'),
      stops: stops.map((stop) => ({
        ...stop,
        folds:
          stop.fold_display === null
            ? []
            : [{ line: idx, cell: { state: 'known', display: stop.fold_display, proof_ref: `sweep:${name}#${stop.index}` } }]
      }))
    });
  });
  return out;
}

interface LineActionResult {
  readonly activeVerb: VerbKey | null;
  readonly openSweepLine: number | null;
  readonly selectedStop: number | null;
  readonly openAnswer: string | null;
}

/** Rezono's line actions against the lines, sweeps and answers built for the page. */
function applyLineActions(
  keys: readonly (string | SlipLineAction)[],
  lines: readonly { readonly answered_verbs?: readonly string[] | undefined }[],
  sweeps: readonly SlipPropsSweep[],
  answers: Readonly<Record<string, unknown>>,
  proposeAllowed: boolean,
  start: LineActionResult
): LineActionResult {
  let { activeVerb, openSweepLine, selectedStop, openAnswer } = start;
  const press = (lineIdx: number, key: string): void => {
    const spec = resolveLineVerbs(lines[lineIdx]?.answered_verbs).find((v) => v.key === key.toLowerCase());
    if (!spec || (spec.verb === 'propose' && !proposeAllowed)) return;
    activeVerb = spec.key;
    if (spec.verb === 'suppose' && sweeps.some((sw) => sw.line === lineIdx)) {
      openSweepLine = openSweepLine === lineIdx ? null : lineIdx;
      selectedStop = null;
      return;
    }
    const answerKey = `${lineIdx}:${spec.verb}`;
    if (answers[answerKey]) openAnswer = openAnswer === answerKey ? null : answerKey;
  };
  for (const action of keys) {
    if (typeof action === 'string') {
      const lineIdx = lines.findIndex((line) =>
        resolveLineVerbs(line.answered_verbs).some((v) => v.key === action.toLowerCase())
      );
      if (lineIdx >= 0) press(lineIdx, action);
      continue;
    }
    if (!Number.isInteger(action.line) || !lines[action.line]) throw new Error(`No line with index ${action.line}`);
    if (action.key !== undefined) press(action.line, action.key);
    if (action.stop !== undefined) {
      const sweep = openSweepLine === action.line ? sweeps.find((sw) => sw.line === action.line) : undefined;
      if (!sweep || !sweep.stops.some((stop) => stop.index === action.stop)) {
        throw new Error(`No stop ${action.stop} on line ${action.line}`);
      }
      selectedStop = action.stop;
    }
  }
  return { activeVerb, openSweepLine, selectedStop, openAnswer };
}

/** Rezono's reader -> the ported view model (build time) -> the props of the one Slip.svelte. */
async function renderFromReader(
  request: SlipRenderRequest,
  payload: SlipFixturePayload,
  component: Component<Record<string, unknown>>,
  files: Readonly<Record<string, string>>
): Promise<SlipRenderResponse> {
  const storeName = typeof request.store === 'string' ? request.store : 'main';
  const role = request.role ?? 'reader';
  const recorded = payload.reader_answers?.[storeName]?.[role];
  if (!recorded) throw new Error(`reader answers: no store "${storeName}" for role "${role}"`);
  const theme: PaletteName = request.theme ?? 'swisstopo';
  const lang = request.lang ?? 'en';
  const pack = request.pack ?? 'slip';

  let handle: ReaderHandler = recordedReader(recorded);
  if (typeof request.reader === 'string') {
    const wrapper = (await import(pathToFileURL(path.resolve(request.reader)).href)) as {
      default?: (next: ReaderHandler) => ReaderHandler;
    };
    if (typeof wrapper.default !== 'function') {
      throw new Error(`Reader wrapper ${request.reader} does not have a default export function`);
    }
    handle = wrapper.default(handle);
  }
  // The model stops when the reader refuses the head, the bundle or the proof of the row ("Unable to read ...").
  // That refusal is the reader not serving the publication: the page then shows no line (Rezono, The seal).
  const refusals: { status: number; error: string | null }[] = [];
  const fetchFn = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const req = input instanceof Request ? input : new Request(new URL(String(input), 'http://localhost'), init);
    const res = await handle(req);
    if (!res.ok) {
      const body = (await res.clone().json().catch(() => null)) as { error?: unknown } | null;
      refusals.push({ status: res.status, error: typeof body?.error === 'string' ? body.error : null });
    }
    return res;
  };

  const row = typeof request.row === 'object' ? request.row : undefined;
  let props: SlipProps;
  let readerHead: ReaderHeadWithSeal;
  try {
    const view = await loadSlip(fetchFn, { pack, lang, row }, await rezonoStdPacks(), await rezonoMessageFiller());
    readerHead = view.head as ReaderHeadWithSeal;
    props = slipPropsFromView(view);
  } catch (err) {
    const refused = refusals.at(-1);
    if (!(err instanceof Error) || !err.message.startsWith('Unable to read') || refused === undefined) throw err;
    const out = svelteRender(component, {
      props: {
        theme,
        unserved: { code: `http_status_${refused.status}`, reason_message_id: refused.error },
        httpStatus: refused.status
      }
    });
    return { html: out.body ?? '', files };
  }

  const seal = sealFromReaderHead(readerHead, role);
  const lines = props.row.grounds_distance_1 ?? props.row.steps ?? [];
  const actions = applyLineActions(request.keys ?? [], lines, props.sweeps, props.answers, seal.canPropose, {
    activeVerb: null,
    openSweepLine: null,
    selectedStop: request.selectedStop ?? null,
    openAnswer: null
  });
  const out = svelteRender(component, {
    props: {
      theme,
      seal,
      sealChecks: props.sealChecks,
      manifestHash: props.manifestHash,
      conformanceRow: props.row,
      answers: props.answers,
      openAnswer: actions.openAnswer,
      sweeps: props.sweeps,
      openSweepLine: actions.openSweepLine,
      selectedStopIndex: actions.selectedStop,
      ...(actions.activeVerb ? { activeVerb: actions.activeVerb } : {})
    }
  });
  return { html: out.body ?? '', files };
}

export async function render(request: SlipRenderRequest): Promise<SlipRenderResponse> {
  // Decision 0011: Seals and seal checks come strictly from the reader/publication; caller overrides are forbidden.
  const rawReq = request as Record<string, unknown>;
  if (rawReq.seal !== undefined || rawReq.sealChecks !== undefined) {
    throw new Error(
      'Slip render: caller-injected seal or sealChecks are forbidden; seals must come from the reader or publication.'
    );
  }

  const slipPath = path.join(SLIP_SRC_DIR, 'Slip.svelte');
  const bundle = compileSvelteFile(slipPath);
  const files = buildFilesHashMap(bundle.compiledCode);
  const mod = (await import(pathToFileURL(bundle.moduleFile).href)) as {
    default: Component<Record<string, unknown>>;
  };

  const payload = loadPayload(request);
  if (payload?.reader_answers) return renderFromReader(request, payload, mod.default, files);
  const lang = request.lang ?? 'en';
  const theme: PaletteName = request.theme ?? 'swisstopo';
  const capability: ReaderCapabilityConfig | undefined = typeof request.reader === 'object' ? request.reader : undefined;

  const unserved: UnservedInfo | null =
    capability?.refuse ??
    payload?.unserved ??
    (payload?.manifest && payload.manifest.witness_check === 'failed'
      ? {
          code: 'witness_failed',
          reason_message_id: 'witness_failed',
          superseded_by: null,
          withdrawn_by_decision_ref: null
        }
      : null);

  if (unserved !== null || payload?.http_status === 410) {
    const out = svelteRender(mod.default, {
      props: {
        theme,
        unserved,
        httpStatus: payload?.http_status ?? 410
      }
    });
    return { html: out.body ?? '', files };
  }

  if (payload?.manifest && request.role !== undefined && request.role !== payload.manifest.role) {
    throw new Error(
      `Slip render: client-side role projection is forbidden (requested role "${request.role}" does not match publication role "${payload.manifest.role}"). Role projection belongs to Rezono.`
    );
  }

  const seal: CartoucheSeal | null = payload?.manifest ? sealFromManifest(payload.manifest) : null;

  let model: SlipModel | null = request.model ?? null;
  if (!model && payload?.slip_enrichment && seal) {
    model = createSlipModel({
      subjectId: payload.fixture_id ?? 'subject',
      proofRef: seal.manifestId,
      seal,
      activeVerb: request.activeVerb ?? 'w',
      prism5: payload.slip_enrichment.prism_5,
      missingLevers: payload.slip_enrichment.missing_levers,
      adjacentWorlds: payload.slip_enrichment.adjacent_worlds_delta1
    });
  }

  let activeVerb: VerbKey = request.activeVerb ?? model?.activeVerb ?? 'w';
  const openedQuestions = new Set<string>();

  let conformanceRow: ConformanceRowPayload | null = null;
  let sweeps: SlipPropsSweep[] = [];
  let openSweepLine: number | null = null;
  let selectedStop: number | null = request.selectedStop ?? null;
  const addedVerbs = resolveReaderExtraVerbs(capability);

  if (payload?.slip_conformance) {
    const conf = payload.slip_conformance;
    const homeKey = conf.home_claim
      ? `${conf.home_claim.relation}::${conf.home_claim.key.join('::')}`
      : undefined;
    const rowId = typeof request.row === 'string' ? request.row : homeKey;
    const rawRow = rowId && conf.rows ? conf.rows[rowId] : undefined;

    if (rawRow) {
      const langMessages = conf.messages?.[lang] ?? conf.messages?.en ?? {};
      const template = langMessages[rawRow.rule_id] ?? rawRow.rule_id;
      const mergedGrounds: readonly SlipGroundLine[] | undefined = rawRow.grounds_distance_1?.map((line) => {
        if (addedVerbs.length === 0) return line;
        return {
          ...line,
          answered_verbs: mergeLineAnsweredVerbs(line.answered_verbs, addedVerbs)
        };
      });

      conformanceRow = {
        ...rawRow,
        sentence: await fixtureSentence(rawRow, conf.messages, lang),
        sentence_template: template,
        ...(mergedGrounds ? { grounds_distance_1: mergedGrounds } : {})
      };

      const availableLineVerbs = new Set<string>();
      for (const line of mergedGrounds ?? []) {
        for (const v of line.answered_verbs ?? []) availableLineVerbs.add(v);
      }
      for (const v of addedVerbs) availableLineVerbs.add(v);

      sweeps = fixtureSweeps(mergedGrounds ?? [], conf.sweeps);
      // `suppose` opens the sweep control of a line; it opens no answer table (Rezono's slip).
      for (const rawKey of request.keys ?? []) {
        if (typeof rawKey !== 'string') continue;
        const res = resolveSlipShortcut(rawKey, {
          proposeAllowed: seal?.canPropose ?? false,
          availableVerbs: [...availableLineVerbs]
        });
        if (res.status !== 'select') continue;
        activeVerb = res.spec.key;
        if (res.spec.verb === 'suppose') {
          const first = sweeps[0];
          if (first) openSweepLine = openSweepLine === null ? first.line : null;
        } else if (res.spec.question !== undefined) {
          openedQuestions.add(res.spec.question);
        }
      }
      const lineActions = (request.keys ?? []).filter((k): k is SlipLineAction => typeof k !== 'string');
      if (lineActions.length > 0) {
        const done = applyLineActions(lineActions, mergedGrounds ?? rawRow.steps ?? [], sweeps, {}, seal?.canPropose ?? false, {
          activeVerb,
          openSweepLine,
          selectedStop,
          openAnswer: null
        });
        openSweepLine = done.openSweepLine;
        selectedStop = done.selectedStop;
        if (done.activeVerb) activeVerb = done.activeVerb;
      }
    }
  } else if (model) {
    for (const rawKey of request.keys ?? []) {
      if (typeof rawKey !== 'string') continue;
      const res = resolveSlipShortcut(rawKey, {
        proposeAllowed: model.proposeAllowed,
        proposeBlockedReason: model.proposeBlockedReason
      });
      if (res.status === 'select') {
        activeVerb = res.spec.key;
        model = selectSlipVerb(model, res.spec.key);
      }
    }
  }

  const openAnswers: AnswerTableSpec[] = [];
  for (const spec of STD_VERBS) {
    if (spec.question !== undefined && openedQuestions.has(spec.question)) {
      openAnswers.push(buildAnswerTable(spec, conformanceRow, capability));
    }
  }

  const out = svelteRender(mod.default, {
    props: {
      theme,
      model,
      seal,
      sealChecks: payload?.seal_checks ?? [],
      horizon: payload?.horizon ?? null,
      activeVerb,
      conformanceRow,
      openAnswers,
      sweeps,
      openSweepLine,
      selectedStopIndex: selectedStop
    }
  });

  return { html: out.body ?? '', files };
}

export const renderSlip = render;

async function runCli(): Promise<void> {
  const inputFlagIdx = process.argv.indexOf('--input');
  let rawJson = '';
  if (inputFlagIdx >= 0 && process.argv[inputFlagIdx + 1]) {
    rawJson = fs.readFileSync(path.resolve(process.cwd(), process.argv[inputFlagIdx + 1]!), 'utf8');
  } else {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    rawJson = Buffer.concat(chunks).toString('utf8');
  }
  const req = JSON.parse(rawJson || '{}') as SlipRenderRequest;
  const res = await render(req);
  process.stdout.write(`${canonicalJson(res)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`render error: ${message}\n`);
    process.exit(1);
  });
}
