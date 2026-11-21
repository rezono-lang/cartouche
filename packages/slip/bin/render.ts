#!/usr/bin/env node
/**
 * Deterministic @rezono/slip render harness (Decision 0006).
 * Accepts a JSON request ({ store | fixture, role, pack, lang, row?, keys?, reader?, theme?, model?, seal?, selectedStop? })
 * and returns { html, files } where `files` maps every built @rezono/slip asset to its LF-normalized SHA-256 digest.
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
import type { CartoucheSeal, ManifestMeta, PaletteName, RawCellInput } from '../../reader-core/src/index.ts';
import { createSlipModel, selectSlipVerb } from '../src/slip-controller.ts';
import type { AdjacentWorldHop, MissingLever, PrismSpectrum, SlipModel, VerbKey } from '../src/slip-controller.ts';
import { resolveSlipShortcut } from '../src/slip-element.ts';
import type { SealCheckItem, UnservedInfo } from '../src/slip-element.ts';
import { buildAnswerTable, mergeLineAnsweredVerbs, resolveReaderExtraVerbs } from '../src/slip-verbs.ts';

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
  readonly horizon?: { readonly complete: boolean; readonly reason: string | null };
  readonly slip_enrichment?: {
    readonly prism_5: readonly PrismSpectrum[];
    readonly missing_levers: readonly MissingLever[];
    readonly adjacent_worlds_delta1: readonly AdjacentWorldHop[];
  };
  readonly slip_conformance?: SlipConformancePayload;
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
  readonly store?: SlipFixturePayload;
  readonly role?: string;
  readonly pack?: string;
  readonly lang?: string;
  readonly theme?: PaletteName;
  readonly row?: string;
  readonly keys?: readonly string[];
  readonly reader?: ReaderCapabilityConfig;
  readonly activeVerb?: VerbKey;
  readonly selectedStop?: number | null;
  readonly seal?: CartoucheSeal | null;
  readonly sealChecks?: readonly SealCheckItem[];
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
  if (request.store) return request.store;
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

function sealFromManifest(manifest: ManifestMeta, roleOverride?: string): CartoucheSeal {
  const canPropose = manifest.witness_check === 'green' && manifest.trust_tier !== 'provisional_engine';
  return Object.freeze({
    manifestId: manifest.id,
    epoch: manifest.epoch,
    knowledgeTime: manifest.knowledge_time,
    role: roleOverride ?? manifest.role,
    witnessCheck: manifest.witness_check,
    trustTier: manifest.trust_tier,
    provisionalCount: manifest.trust_tier === 'sealed' ? 0 : 1,
    canPropose
  });
}

function extraReaderVerbs(reader?: ReaderCapabilityConfig): readonly string[] {
  if (!reader) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const addVerb = (verbName: string) => {
    if (!seen.has(verbName)) {
      seen.add(verbName);
      out.push(verbName);
    }
  };
  for (const v of reader.answeredVerbs ?? []) {
    const spec = STD_VERBS.find((s) => s.verb === v || s.key === v || s.question === v);
    if (spec) addVerb(spec.verb);
  }
  for (const q of reader.answeredQuestions ?? []) {
    const spec = STD_VERBS.find((s) => s.question === q || s.verb === q);
    if (spec) addVerb(spec.verb);
  }
  return out;
}

function synthesizeAnswerTable(
  question: string,
  verb: string,
  row: ConformanceRowPayload | null,
  reader?: ReaderCapabilityConfig
): AnswerTableSpec {
  const explicit = reader?.answersByQuestion?.[question];
  if (explicit) return explicit;

  if (question === 'grounds' && row?.grounds_distance_1) {
    return {
      question,
      verb,
      headers: ['Relation', 'Key', 'State', 'Proof'],
      rows: row.grounds_distance_1.map((line) => ({
        cells: [line.relation, canonicalJson(line.key), line.cell.state, line.cell.proof_ref],
        proof_ref: line.cell.proof_ref,
        sign: line.sign
      }))
    };
  }
  return {
    question,
    verb,
    headers: ['Question', 'Status'],
    rows: []
  };
}

export async function render(request: SlipRenderRequest): Promise<SlipRenderResponse> {
  const slipPath = path.join(SLIP_SRC_DIR, 'Slip.svelte');
  const bundle = compileSvelteFile(slipPath);
  const files = buildFilesHashMap(bundle.compiledCode);
  const mod = (await import(pathToFileURL(bundle.moduleFile).href)) as {
    default: Component<Record<string, unknown>>;
  };

  const payload = loadPayload(request);
  const lang = request.lang ?? 'en';
  const theme: PaletteName = request.theme ?? 'swisstopo';

  const unserved: UnservedInfo | null =
    request.reader?.refuse ??
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

  const seal: CartoucheSeal | null =
    request.seal !== undefined
      ? request.seal
      : payload?.manifest
        ? sealFromManifest(payload.manifest, request.role)
        : null;

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
  let sweepStops: readonly SweepStopPayload[] = [];
  const addedVerbs = resolveReaderExtraVerbs(request.reader);

  if (payload?.slip_conformance) {
    const conf = payload.slip_conformance;
    const homeKey = conf.home_claim
      ? `${conf.home_claim.relation}::${conf.home_claim.key.join('::')}`
      : undefined;
    const rowId = request.row ?? homeKey;
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
        sentence_template: template,
        ...(mergedGrounds ? { grounds_distance_1: mergedGrounds } : {})
      };

      const availableLineVerbs = new Set<string>();
      for (const line of mergedGrounds ?? []) {
        for (const v of line.answered_verbs ?? []) availableLineVerbs.add(v);
      }
      for (const v of addedVerbs) availableLineVerbs.add(v);

      for (const rawKey of request.keys ?? []) {
        const res = resolveSlipShortcut(rawKey, {
          proposeAllowed: seal?.canPropose ?? false,
          availableVerbs: [...availableLineVerbs]
        });
        if (res.status === 'select') {
          activeVerb = res.spec.key;
          openedQuestions.add(res.spec.question);
        }
      }

      if (openedQuestions.has('sweep') && conf.sweeps) {
        const sweepLine = mergedGrounds?.find((g) => g.sweep_name !== undefined);
        const sweepData = sweepLine?.sweep_name ? conf.sweeps[sweepLine.sweep_name] : undefined;
        if (sweepData) {
          const role = request.role ?? payload.manifest?.role ?? 'reader';
          sweepStops = role === 'summary' ? (sweepData.stops_summary ?? []) : (sweepData.stops_reader ?? []);
        }
      }
    }
  } else if (model) {
    for (const rawKey of request.keys ?? []) {
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
    if (openedQuestions.has(spec.question)) {
      openAnswers.push(buildAnswerTable(spec, conformanceRow, request.reader));
    }
  }

  const out = svelteRender(mod.default, {
    props: {
      theme,
      model,
      seal,
      sealChecks: request.sealChecks ?? [],
      horizon: payload?.horizon ?? null,
      activeVerb,
      conformanceRow,
      openAnswers,
      sweepStops,
      selectedStopIndex: request.selectedStop ?? null
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
