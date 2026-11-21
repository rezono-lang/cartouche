/**
 * The slip's view model (Decision 0009), ported from rezono-lang/rezono viewer/slip/src/model.ts at
 * f15c89d665e2815b02e12665203a9d48dd6abc40 (blob sha256 in packages/slip/rezono-source.json, "ported").
 *
 * It runs at build time, inside packages/slip/bin/render.ts, and never in the page bundle (Decision 0001): it asks
 * the reader's routes through `fetchFn` and returns everything the page can show, every answer table, stop and fold
 * included. The text is Rezono's apart from these changes, each marked "Cartouche:" below:
 *  - the message filler (viewer/messages/src/fill.ts) and std packs are passed in, read at the pinned commit;
 *  - the folds of every stop are computed here from each variant's published difference (foldsByVariant), where
 *    Rezono's page fetched the difference in the browser when a stop was picked;
 *  - `cell.manifest.length > 0` reads `cell.manifest !== ''` (zero-compute lint, ZC07);
 *  - the head is kept on the view, so the seal quotes what the reader served;
 *  - types are tightened for Cartouche's strict compiler settings.
 *
 * Computation Disposition Audit (Decision 0009 point 1 & Decision 0011 §2 item 13):
 * This module runs STRICTLY at build time inside `packages/slip/bin/render.ts` and is NEVER imported by browser/page
 * bundle files (`Slip.svelte`, `slip-element.ts`, `packages/slip/src/index.ts`). Each of the 10 computations currently
 * carried over from Rezono's reference model has an explicit target disposition:
 *  1. Choosing the home row -> Target: Rezono reader. Today the role's bundle names the home claim and `rows?limit=2` is
 *     asked per relation until one has exactly one row; the reader should answer "the row this role opens on" itself.
 *     Build-time only here.
 *  2. Pairing witnesses & calculation witnesses with lines -> Target: Rezono reader/gate (`/ask/grounds` pre-joined lines); build-time only here.
 *  3. Binding rule variables to lines via body atom positions -> Target: Rezono publisher/gate (pre-bound sentence segments with line indices); build-time only here.
 *  4. Placing aggregate totals before their contributors -> Target: Rezono reader/gate (canonical grounds order with `part: "total"` and `depth`); build-time only here.
 *  5. Matching calculation steps to premise rows -> Target: Rezono reader/gate (pre-linked calc steps in display order); build-time only here.
 *  6. Choosing origin signs -> Target: Rezono publisher (`packs/std-view/key.yaml` sign attached to each published row); build-time only here.
 *  7. Parsing `known:` values and keys -> Target: Rezono reader/gate (structured `{ state, display, reason }` opaque cells); build-time only here.
 *  8. Resolving a sweep's table through kind inheritance -> Target: Rezono reader/gate (bound target relation/slot on `/sweeps`); build-time only here.
 *  9. Normalising stop statuses and turns -> Dropped, not moved: the reader already serves the canonical values
 *     (`green|warning|red|not_computed|unavailable`, `turns|same|unknown`). Rezono's page mapped an unknown status to
 *     `unavailable`, dropped an unknown turn and rewrote a turn on an unavailable stop to `unknown`; Cartouche refuses
 *     such an answer instead (issue #23 §2), so nothing the reader did not say is shown.
 * 10. Pairing a variant's difference entries with lines into folds -> Target: Rezono reader. Its `scenario` answer
 *     already pairs `changed` rows by Rezono's "same row" rule (decisions/viewer-slip.md, Turning points); a fold per
 *     slip line (relation, key, old and new cell) belongs in that answer. Until then: build time here, never in the
 *     browser.
 */
import type {
	AnswerTable,
	AnswerTableRow,
	BoundSweepCellResponse,
	BoundSweepListResponse,
	CalcStep,
	ExplainAnswer,
	FetchLike,
	GroundsNode,
	GroundsStep,
	HeadResponse,
	LineFold,
	LineSweep,
	LineVerb,
	MessageArgs,
	MessageFiller,
	MessagePart,
	MessageResource,
	RoleBundleResponse,
	RowSelection,
	SentenceSegment,
	SignInfo,
	SlipLine,
	SlipView,
	StdPacks,
	SweepCheckInfo,
	SweepStop,
	SweepStopStatus,
	SweepTurnStatus,
	ValueState,
} from './types.ts';

// Cartouche: Rezono imports fill/fillParts from viewer/messages/src/fill.ts; here the same module, read at the
// pinned commit, is handed to loadSlip and used through these two delegates.
let messageFiller: MessageFiller | undefined;

function filler(): MessageFiller {
	if (!messageFiller) throw new Error('slip model: no message filler (viewer/messages/src/fill.ts) was given');
	return messageFiller;
}

function fill(resources: readonly MessageResource[], lang: string, id: string, args: MessageArgs = {}): string | undefined {
	return filler().fill(resources, lang, id, args);
}

function fillParts(
	resources: readonly MessageResource[],
	lang: string,
	id: string,
	args: MessageArgs = {},
): readonly MessagePart[] | undefined {
	return filler().fillParts(resources, lang, id, args);
}

/** Cartouche: the message filler the model fills every text with (viewer/messages/src/fill.ts at the pin). */
export function useMessageFiller(next: MessageFiller): void {
	messageFiller = next;
}

interface RuleTermLike {
	kind?: string;
	value?: string;
}

interface RuleLiteralLike {
	kind?: string;
	position?: number;
	polarity?: string;
	relation?: string;
	terms?: RuleTermLike[];
	result?: RuleTermLike;
}

interface RuleLike {
	id: string;
	message?: string;
	body?: RuleLiteralLike[];
}

interface AggregateWitnessLike {
	relation: string;
	position?: number;
	group_key: string;
	count: number;
	result: string;
}

function canonicalKey(parts: readonly string[]): string {
	return JSON.stringify(parts.map(String));
}

function parseKey(raw: string): string[] {
	try {
		const parsed: unknown = JSON.parse(raw);
		if (Array.isArray(parsed) && parsed.every((p) => typeof p === 'string')) {
			return parsed;
		}
	} catch {
		// fall through
	}
	return [raw];
}

function stripQuestionPrefix(name: string): string {
	return name.startsWith('?') ? name.slice(1) : name;
}

function rowId(relation: string, key: string): string {
	return `${relation}\u0000${key}`;
}

export function parseStateValue(raw: string): { state: ValueState; value: string; reason: string } {
	if (raw.startsWith('known:')) {
		return { state: 'known', value: raw.slice('known:'.length), reason: '' };
	}
	for (const state of ['unknown', 'not_applicable', 'invalid'] as const) {
		if (raw === state) {
			return { state, value: '', reason: '' };
		}
		if (raw.startsWith(`${state}:`)) {
			return { state, value: '', reason: raw.slice(state.length + 1) };
		}
	}
	return { state: 'known', value: raw, reason: '' };
}

function viewMessage(
	stdPacks: StdPacks,
	lang: string,
	id: string,
	args: Record<string, string | number | boolean> = {},
): string {
	return (
		fill(stdPacks.viewMessages, lang, id, args) ??
		fill(stdPacks.viewMessages, 'en', id, args) ??
		id
	);
}

function explainMessage(
	stdPacks: StdPacks,
	lang: string,
	id: string,
	args: Record<string, string | number | boolean> = {},
): string | undefined {
	return (
		fill(stdPacks.explainMessages, lang, id, args) ??
		fill(stdPacks.explainMessages, 'en', id, args)
	);
}

export function buildSignCatalog(stdPacks: StdPacks, lang: string): SignInfo[] {
	const catalog: SignInfo[] = [];
	const seen = new Set<string>();
	for (const status of stdPacks.statuses) {
		if (seen.has(status.status)) continue;
		seen.add(status.status);
		catalog.push({
			name: status.status,
			glyph: status.glyph ?? '',
			label: viewMessage(stdPacks, lang, status.label_message),
		});
	}
	for (const sign of stdPacks.signs) {
		if (seen.has(sign.sign)) continue;
		seen.add(sign.sign);
		catalog.push({
			name: sign.sign,
			glyph: sign.glyph ?? '',
			label: viewMessage(stdPacks, lang, sign.label_message),
			form: sign.form,
		});
	}
	return catalog;
}

function signByName(catalog: readonly SignInfo[], name: string): SignInfo | undefined {
	return catalog.find((entry) => entry.name === name);
}

function stateSign(catalog: readonly SignInfo[], state: ValueState): SignInfo | undefined {
	if (state === 'known') return undefined;
	if (state === 'invalid') return signByName(catalog, 'violated');
	return signByName(catalog, state);
}

function formatNonKnownText(
	bundle: RoleBundleResponse,
	stdPacks: StdPacks,
	lang: string,
	state: ValueState,
	reason: string,
): string {
	const stateLabel = viewMessage(stdPacks, lang, `status.${state}`);
	if (!reason) {
		return stateLabel;
	}
	const packReason = fill(bundle.messages, lang, `reason.${reason}`, {});
	const reasonText = packReason ?? reason;
	return viewMessage(stdPacks, lang, 'value.reason', {
		value: stateLabel,
		reason: reasonText,
	});
}

function labelOf(bundle: RoleBundleResponse, lang: string, element: string): string {
	const direct = bundle.labels.find((l) => l.element === element && l.lang === lang);
	if (direct) return direct.text;
	const slot =
		bundle.attributes.find((a) => a.table === element) ??
		bundle.arrows.find((a) => a.table === element);
	if (slot) {
		const slotLabel = bundle.labels.find((l) => l.element === slot.id && l.lang === lang);
		if (slotLabel) return slotLabel.text;
	}
	return element;
}

function calcLeafLabel(bundle: RoleBundleResponse, lang: string, step: CalcStep): string {
	if (step.ref) {
		const direct = bundle.labels.find((l) => l.element === step.ref && l.lang === lang);
		if (direct) return direct.text;
	}
	if (step.relation) {
		const relLabel = labelOf(bundle, lang, step.relation);
		if (relLabel !== step.relation) return relLabel;
	}
	return step.ref ?? step.relation ?? step.op;
}

function formatLineLabel(
	bundle: RoleBundleResponse,
	lang: string,
	stdPacks: StdPacks,
	relation: string,
	keyParts: readonly string[],
	polarity: 'positive' | 'negative',
): string {
	const relLabel = labelOf(bundle, lang, relation);
	const sep = viewMessage(stdPacks, lang, 'value.separator');
	if (polarity === 'negative') {
		return viewMessage(stdPacks, lang, 'lead.absent', {
			relation: relLabel,
			row: keyParts.join(sep),
		});
	}
	const isSlot =
		bundle.attributes.some((a) => a.table === relation) ||
		bundle.arrows.some((a) => a.table === relation);
	if (isSlot && keyParts.length >= 2) {
		return viewMessage(stdPacks, lang, 'lead.row', {
			relation: relLabel,
			row: keyParts[0] ?? '',
		});
	}
	return relLabel;
}

function formatLineValue(
	bundle: RoleBundleResponse,
	lang: string,
	stdPacks: StdPacks,
	catalog: readonly SignInfo[],
	relation: string,
	keyParts: readonly string[],
	polarity: 'positive' | 'negative',
	stepValue: string | undefined,
): { state: ValueState; value: string; reason: string; valueSign?: SignInfo | undefined } {
	if (polarity === 'negative') {
		return {
			state: 'absent',
			value: formatNonKnownText(bundle, stdPacks, lang, 'absent', ''),
			reason: '',
			valueSign: stateSign(catalog, 'absent'),
		};
	}
	if (stepValue !== undefined) {
		const parsed = parseStateValue(stepValue);
		if (parsed.state !== 'known') {
			return {
				state: parsed.state,
				value: formatNonKnownText(bundle, stdPacks, lang, parsed.state, parsed.reason),
				reason: parsed.reason,
				valueSign: stateSign(catalog, parsed.state),
			};
		}
		return parsed;
	}
	const sep = viewMessage(stdPacks, lang, 'value.separator');
	const isSlot =
		bundle.attributes.some((a) => a.table === relation) ||
		bundle.arrows.some((a) => a.table === relation);
	if (isSlot && keyParts.length >= 2) {
		return { state: 'known', value: keyParts.slice(1).join(sep), reason: '' };
	}
	return { state: 'known', value: keyParts.join(sep), reason: '' };
}

function originSignForSourceKind(
	catalog: readonly SignInfo[],
	kind: string | undefined,
): SignInfo | undefined {
	const k = (kind ?? '').trim().toLowerCase();
	if (k === 'decision' || k === 'law' || k === 'statute' || k === 'policy') {
		return signByName(catalog, 'origin_decision');
	}
	if (k === 'vendor' || k === 'manual' || k === 'spec') {
		return signByName(catalog, 'origin_vendor');
	}
	if (k === 'design' || k === 'synthetic' || k === 'schema' || k === 'config') {
		return signByName(catalog, 'origin_design');
	}
	if (k === 'observation' || k === 'measurement' || k === 'fact') {
		return signByName(catalog, 'origin_observation');
	}
	return undefined;
}

function formatSourceCitation(name: string, position?: string): string {
	const base = name.startsWith('@') ? name : `@${name}`;
	if (!position) return base;
	return position.startsWith('#') ? `${base}${position}` : `${base}#${position}`;
}

function formatOrigin(
	bundle: RoleBundleResponse,
	lang: string,
	stdPacks: StdPacks,
	catalog: readonly SignInfo[],
	node: GroundsNode,
	answer: ExplainAnswer,
	polarity: 'positive' | 'negative',
	forProofTree = false,
): { origin: string; originSign?: SignInfo | undefined } {
	if (polarity === 'negative') {
		return { origin: viewMessage(stdPacks, lang, 'status.absent') };
	}
	if (node.sources && node.sources.length > 0) {
		const first = node.sources[0]!;
		if (forProofTree) {
			return {
				origin: formatSourceCitation(first.name, first.position),
				originSign: originSignForSourceKind(catalog, first.kind),
			};
		}
		return { origin: first.position ? `${first.name}:${first.position}` : first.name };
	}
	const witness = (answer.witnesses ?? []).find(
		(w) => w.conclusion.relation === node.relation && w.conclusion.key === node.key,
	);
	if (witness) {
		return {
			origin: labelOf(bundle, lang, witness.rule_id),
			originSign: signByName(catalog, 'derived'),
		};
	}
	const calcWitness = (answer.calc_witnesses ?? []).find(
		(cw) => cw.conclusion.relation === node.relation && cw.conclusion.key === node.key,
	);
	if (calcWitness) {
		return {
			origin: labelOf(bundle, lang, calcWitness.rule),
			originSign: signByName(catalog, 'derived'),
		};
	}
	return { origin: '' };
}

function buildSeal(
	head: HeadResponse,
	lang: string,
	stdPacks: StdPacks,
	catalog: readonly SignInfo[],
) {
	return {
		manifestSha256: head.manifest_sha256,
		witnessCheck: head.witness_check,
		manifestLabel: viewMessage(stdPacks, lang, 'cartouche.manifest'),
		readerHashesLabel: viewMessage(stdPacks, lang, 'sign.sealed'),
		sealSign: signByName(catalog, 'sealed'),
	};
}

function buildHeaders(lang: string, stdPacks: StdPacks) {
	return {
		line: viewMessage(stdPacks, lang, 'waterfall.row'),
		value: viewMessage(stdPacks, lang, 'answer.value'),
		origin: viewMessage(stdPacks, lang, 'zone.rests'),
		verbs: viewMessage(stdPacks, lang, 'zone.verbs'),
	};
}

function buildLegendHeaders(lang: string, stdPacks: StdPacks) {
	return {
		title: viewMessage(stdPacks, lang, 'key.title'),
		sign: viewMessage(stdPacks, lang, 'specimen.column.sign'),
		meaning: viewMessage(stdPacks, lang, 'specimen.column.meaning'),
	};
}

function formatRowRefText(
	bundle: RoleBundleResponse,
	stdPacks: StdPacks,
	lang: string,
	relation: string,
	key: string,
): string {
	const sep = viewMessage(stdPacks, lang, 'value.separator');
	const parts = parseKey(key);
	return viewMessage(stdPacks, lang, 'lead.row', {
		relation: labelOf(bundle, lang, relation),
		row: parts.join(sep),
	});
}

export function buildAnswerTable(
	bundle: RoleBundleResponse,
	stdPacks: StdPacks,
	lang: string,
	questionTerm: string,
	shape: string,
	answer: ExplainAnswer,
	catalog: readonly SignInfo[],
): AnswerTable {
	const elementText = answer.start
		? formatRowRefText(bundle, stdPacks, lang, answer.start.relation, answer.start.key)
		: questionTerm;
	const heading =
		explainMessage(stdPacks, lang, `explain.${questionTerm}.question`, { element: elementText }) ??
		explainMessage(stdPacks, lang, `explain.${questionTerm}`) ??
		questionTerm;
	const moreLabel =
		answer.more && answer.more.length > 0
			? explainMessage(stdPacks, lang, 'explain.more')
			: undefined;

	if (shape === 'route') {
		const headers = [
			viewMessage(stdPacks, lang, 'answer.distance'),
			viewMessage(stdPacks, lang, 'waterfall.row'),
			viewMessage(stdPacks, lang, 'answer.value'),
			viewMessage(stdPacks, lang, 'zone.rests'),
		];
		const stepsByPremise = new Map<string, GroundsStep[]>();
		for (const step of answer.steps ?? []) {
			const id = rowId(step.premise.relation, step.premise.key);
			const list = stepsByPremise.get(id);
			if (list) list.push(step);
			else stepsByPremise.set(id, [step]);
		}
		// Shared DAG deduplication: a premise reached by multiple paths appears once,
		// preserving first-seen reader order.
		const uniqueNodes: GroundsNode[] = [];
		const nodeIndexById = new Map<string, number>();
		for (const n of answer.nodes) {
			if (n.outside) {
				uniqueNodes.push(n);
				continue;
			}
			const id = rowId(n.relation, n.key);
			if (nodeIndexById.has(id)) continue;
			nodeIndexById.set(id, uniqueNodes.length);
			uniqueNodes.push(n);
		}

		const buildConclusionDetails = (
			node: GroundsNode,
		): {
			sentence?: readonly SentenceSegment[] | undefined;
			bindings?: readonly import('./types.ts').AnswerBinding[] | undefined;
		} => {
			const witness = (answer.witnesses ?? []).find(
				(w) => w.conclusion.relation === node.relation && w.conclusion.key === node.key,
			);
			if (!witness) return {};
			const rule = (bundle.rules as unknown as RuleLike[]).find((r) => r.id === witness.rule_id);
			const directSteps = (answer.steps ?? []).filter(
				(s) => s.conclusion.relation === node.relation && s.conclusion.key === node.key,
			);
			const atomPosToRow = new Map<number, number>();
			const aggPosToRow = new Map<number, number>();
			for (const s of directSteps) {
				const targetIdx = nodeIndexById.get(rowId(s.premise.relation, s.premise.key));
				if (targetIdx === undefined) continue;
				if (s.how === 'contributes') {
					if (!aggPosToRow.has(s.position)) aggPosToRow.set(s.position, targetIdx);
				} else if (!atomPosToRow.has(s.position)) {
					atomPosToRow.set(s.position, targetIdx);
				}
			}
			const varToRow = new Map<string, number>();
			let atomIdx = 0;
			let aggIdx = 0;
			for (const literal of rule?.body ?? []) {
				if (literal.kind === 'atom') {
					const pos = atomIdx++;
					if (literal.polarity === 'positive') {
						const rowIdx = atomPosToRow.get(pos);
						if (rowIdx !== undefined) {
							for (const term of literal.terms ?? []) {
								if (term.kind === 'variable' && typeof term.value === 'string') {
									const name = stripQuestionPrefix(term.value);
									if (!varToRow.has(name)) varToRow.set(name, rowIdx);
								}
							}
						}
					}
				} else if (literal.kind === 'aggregate') {
					const pos = aggIdx++;
					const rowIdx = aggPosToRow.get(pos);
					if (
						rowIdx !== undefined &&
						literal.result?.kind === 'variable' &&
						typeof literal.result.value === 'string'
					) {
						const name = stripQuestionPrefix(literal.result.value);
						if (!varToRow.has(name)) varToRow.set(name, rowIdx);
					}
				}
			}
			const args: Record<string, string> = {};
			const bindings: import('./types.ts').AnswerBinding[] = [];
			for (const binding of witness.bindings ?? []) {
				const name = stripQuestionPrefix(binding.variable);
				args[name] = binding.value;
				let target = varToRow.get(name);
				if (target === undefined) {
					for (const s of directSteps) {
						const parts = parseKey(s.premise.key);
						if (parts.includes(binding.value)) {
							const idx = nodeIndexById.get(rowId(s.premise.relation, s.premise.key));
							if (idx !== undefined) {
								target = idx;
								break;
							}
						}
					}
				}
				bindings.push(
					target !== undefined
						? { variable: name, value: binding.value, line: target }
						: { variable: name, value: binding.value },
				);
			}
			const messageId = rule?.message ?? `rule.${witness.rule_id}`;
			const parts = fillParts(bundle.messages, lang, messageId, args);
			const sentence = parts
				? parts.map((part) => {
						if (part.kind === 'var') {
							const target = varToRow.get(part.name);
							if (target !== undefined) return { text: part.text, line: target };
						}
						return { text: part.text };
					})
				: undefined;
			return {
				...(sentence ? { sentence } : {}),
				...(bindings.length > 0 ? { bindings } : {}),
			};
		};

		const buildPremiseLinks = (
			node: GroundsNode,
			alreadyLinked: ReadonlySet<number>,
		): readonly import('./types.ts').AnswerPremiseLink[] | undefined => {
			const directSteps = (answer.steps ?? []).filter(
				(s) => s.conclusion.relation === node.relation && s.conclusion.key === node.key,
			);
			if (directSteps.length === 0) return undefined;
			const seenLines = new Set<number>(alreadyLinked);
			const links: import('./types.ts').AnswerPremiseLink[] = [];
			for (const s of directSteps) {
				const targetIdx = nodeIndexById.get(rowId(s.premise.relation, s.premise.key));
				if (targetIdx === undefined || seenLines.has(targetIdx)) continue;
				seenLines.add(targetIdx);
				const premKeyParts = parseKey(s.premise.key);
				const premPol: 'positive' | 'negative' = s.how === 'negative' ? 'negative' : 'positive';
				links.push({
					line: targetIdx,
					label: formatLineLabel(bundle, lang, stdPacks, s.premise.relation, premKeyParts, premPol),
				});
			}
			return links.length > 0 ? links : undefined;
		};

		const rows: AnswerTableRow[] = uniqueNodes.map((node, idx) => {
			if (node.outside) {
				const outsideText =
					explainMessage(stdPacks, lang, 'explain.outside') ??
					viewMessage(stdPacks, lang, 'sign.screened');
				return {
					line: idx,
					depth: node.distance,
					cells: [
						{ text: String(node.distance) },
						{ text: outsideText, sign: signByName(catalog, 'screened') },
						{ text: '' },
						{ text: '' },
					],
				};
			}
			const steps = stepsByPremise.get(rowId(node.relation, node.key)) ?? [];
			const polarity: 'positive' | 'negative' = steps.some((s) => s.how === 'negative')
				? 'negative'
				: 'positive';
			const keyParts = parseKey(node.key);
			const formatted = formatLineValue(
				bundle,
				lang,
				stdPacks,
				catalog,
				node.relation,
				keyParts,
				polarity,
				steps[0]?.value,
			);
			const originInfo = formatOrigin(bundle, lang, stdPacks, catalog, node, answer, polarity, true);
			const conclusionDetails = node.distance === 0 ? buildConclusionDetails(node) : {};
			const alreadyLinked = new Set<number>();
			for (const seg of conclusionDetails.sentence ?? []) {
				if (seg.line !== undefined) alreadyLinked.add(seg.line);
			}
			for (const b of conclusionDetails.bindings ?? []) {
				if (b.line !== undefined) alreadyLinked.add(b.line);
			}
			const premiseLinks = buildPremiseLinks(node, alreadyLinked);
			const isLeaf = Boolean(node.sources && node.sources.length > 0);
			return {
				line: idx,
				depth: node.distance,
				relation: node.relation,
				key: node.key,
				polarity,
				...(conclusionDetails.sentence ? { sentence: conclusionDetails.sentence } : {}),
				...(conclusionDetails.bindings ? { bindings: conclusionDetails.bindings } : {}),
				...(premiseLinks ? { premiseLinks } : {}),
				...(isLeaf ? { source: originInfo.origin } : {}),
				state: formatted.state,
				reason: formatted.reason,
				cells: [
					{ text: String(node.distance) },
					{ text: formatLineLabel(bundle, lang, stdPacks, node.relation, keyParts, polarity) },
					{ text: formatted.value, sign: formatted.valueSign },
					{ text: originInfo.origin, sign: originInfo.originSign },
				],
			};
		});
		return { question: questionTerm, shape, heading, headers, rows, moreLabel };
	}

	if (shape === 'rings') {
		const headers = [
			viewMessage(stdPacks, lang, 'effect.col.ring'),
			viewMessage(stdPacks, lang, 'effect.col.sector'),
			viewMessage(stdPacks, lang, 'effect.col.row'),
		];
		const sep = viewMessage(stdPacks, lang, 'value.separator');
		const rows: AnswerTableRow[] = answer.nodes.map((node) => {
			if (node.outside) {
				const outsideText =
					explainMessage(stdPacks, lang, 'explain.outside') ??
					viewMessage(stdPacks, lang, 'sign.screened');
				return {
					depth: node.distance,
					cells: [
						{ text: viewMessage(stdPacks, lang, 'answer.ring', { distance: node.distance }) },
						{ text: outsideText, sign: signByName(catalog, 'screened') },
						{ text: '' },
					],
				};
			}
			const keyParts = parseKey(node.key);
			return {
				depth: node.distance,
				cells: [
					{ text: viewMessage(stdPacks, lang, 'answer.ring', { distance: node.distance }) },
					{ text: labelOf(bundle, lang, node.relation) },
					{ text: keyParts.join(sep) },
				],
			};
		});
		return { question: questionTerm, shape, heading, headers, rows, moreLabel };
	}

	if (shape === 'gap') {
		const headers = [
			viewMessage(stdPacks, lang, 'answer.distance'),
			viewMessage(stdPacks, lang, 'answer.premises'),
			viewMessage(stdPacks, lang, 'answer.candidates'),
		];
		const sep = viewMessage(stdPacks, lang, 'value.separator');
		const gap = answer.gap;
		const premises = gap?.premises ?? [];
		const candidates = gap?.candidates ?? [];
		const rows: AnswerTableRow[] = premises.map((premise, idx) => {
			const nodeText = formatRowRefText(
				bundle,
				stdPacks,
				lang,
				premise.node.relation,
				premise.node.key,
			);
			const itemText = viewMessage(stdPacks, lang, `gap.item.${premise.kind}`);
			const premiseText = viewMessage(stdPacks, lang, 'gap.premise', {
				node: nodeText,
				relation: labelOf(bundle, lang, premise.relation ?? premise.rule),
				item: itemText,
			});
			const matched = candidates
				.filter((c) => c.premise === idx)
				.map((c) =>
					viewMessage(stdPacks, lang, 'gap.candidate', {
						relation: labelOf(bundle, lang, c.relation),
						key: parseKey(c.key).join(sep),
						change: viewMessage(stdPacks, lang, `gap.${c.change}`),
					}),
				)
				.join(sep);
			return {
				depth: premise.distance,
				cells: [{ text: String(premise.distance) }, { text: premiseText }, { text: matched }],
			};
		});
		if (rows.length === 0) {
			const emptyText =
				explainMessage(stdPacks, lang, 'explain.empty', { element: elementText }) ??
				viewMessage(stdPacks, lang, 'table.empty');
			rows.push({ cells: [{ text: '0' }, { text: emptyText }, { text: '' }] });
		}
		return {
			question: questionTerm,
			shape,
			heading,
			headers,
			rows,
			cutMessage: gap?.cut ? viewMessage(stdPacks, lang, 'answer.cut') : undefined,
			moreLabel,
		};
	}

	if (shape === 'overlay') {
		const headers = [
			viewMessage(stdPacks, lang, 'effect.col.sector'),
			viewMessage(stdPacks, lang, 'effect.col.row'),
			viewMessage(stdPacks, lang, 'effect.col.change'),
		];
		const sep = viewMessage(stdPacks, lang, 'value.separator');
		const entries = answer.difference?.entries ?? [];
		const rows: AnswerTableRow[] = entries.map((entry) => ({
			cells: [
				{ text: labelOf(bundle, lang, entry.relation) },
				{ text: parseKey(entry.key).join(sep) },
				{ text: viewMessage(stdPacks, lang, `impact.${entry.change}`) },
			],
		}));
		return { question: questionTerm, shape, heading, headers, rows, moreLabel };
	}

	// series (or fallback tabular form)
	const headers = [
		viewMessage(stdPacks, lang, 'scale.value'),
		viewMessage(stdPacks, lang, 'scale.status'),
		viewMessage(stdPacks, lang, 'scale.difference'),
	];
	const sep = viewMessage(stdPacks, lang, 'value.separator');
	const rows: AnswerTableRow[] = (answer.series ?? []).map((cell) => {
		const diffText = (cell.counts ?? [])
			.map((c) =>
				viewMessage(stdPacks, lang, 'scale.counts', {
					relation: labelOf(bundle, lang, c.relation),
					added: c.added,
					removed: c.removed,
					changed: c.changed,
				}),
			)
			.join(sep);
		return {
			cells: [
				{ text: cell.value },
				{ text: viewMessage(stdPacks, lang, `scale.${cell.status}`) },
				{ text: diffText || viewMessage(stdPacks, lang, 'scale.no_difference') },
			],
		};
	});
	return { question: questionTerm, shape, heading, headers, rows, moreLabel };
}

export function buildRuleSlipView(
	pack: string,
	lang: string,
	head: HeadResponse,
	bundle: RoleBundleResponse,
	row: RowSelection,
	answer: ExplainAnswer,
	stdPacks: StdPacks,
): SlipView {
	const catalog = buildSignCatalog(stdPacks, lang);
	const startKey = canonicalKey(row.key);
	const start = answer.start ?? { relation: row.relation, key: startKey };
	const witnesses = answer.witnesses ?? [];
	const calcWitnesses = answer.calc_witnesses ?? [];
	const steps = answer.steps ?? [];

	const witness = witnesses.find(
		(w) => w.conclusion.relation === start.relation && w.conclusion.key === start.key,
	);
	const calcWitness = !witness
		? calcWitnesses.find(
				(cw) => cw.conclusion.relation === start.relation && cw.conclusion.key === start.key,
			)
		: undefined;
	const rule = witness
		? (bundle.rules as unknown as RuleLike[]).find((r) => r.id === witness.rule_id)
		: undefined;

	const lines: SlipLine[] = [];
	const atomPosToLine = new Map<number, number>();
	const aggPosToLine = new Map<number, number>();

	if (calcWitness) {
		const subject = parseKey(start.key)[0] ?? '';
		const ruleLabel = labelOf(bundle, lang, calcWitness.rule);
		const premises = calcWitness.premises ?? [];
		for (const step of calcWitness.steps ?? []) {
			const depth = Math.max(0, step.path.split('/').length - 2);
			const state = step.state as ValueState;
			const reason = state === 'known' ? '' : (step.reason ?? '');
			const value =
				state === 'known'
					? (step.value ?? '')
					: formatNonKnownText(bundle, stdPacks, lang, state, reason);
			const valueSign = stateSign(catalog, state);

			let stepRelation = start.relation;
			let stepKey = start.key;
			let matchedNode: GroundsNode | undefined;
			if (step.relation) {
				const targetSubject = step.element ?? subject;
				const matchedPremise = premises.find(
					(p) =>
						p.relation === step.relation &&
						(!targetSubject || parseKey(p.key)[0] === targetSubject),
				);
				if (matchedPremise) {
					stepRelation = matchedPremise.relation;
					stepKey = matchedPremise.key;
				} else {
					const nodeMatch = answer.nodes.find(
						(n) =>
							!n.outside &&
							n.relation === step.relation &&
							(!targetSubject || parseKey(n.key)[0] === targetSubject),
					);
					if (nodeMatch) {
						stepRelation = nodeMatch.relation;
						stepKey = nodeMatch.key;
						matchedNode = nodeMatch;
					} else {
						stepRelation = step.relation;
						stepKey = canonicalKey(targetSubject ? [targetSubject] : []);
					}
				}
				matchedNode ??= answer.nodes.find(
					(n) => !n.outside && n.relation === stepRelation && n.key === stepKey,
				);
			}

			let label: string;
			if (step.op === 'fact') {
				label = viewMessage(stdPacks, lang, 'route.calc.fact', {
					fact: calcLeafLabel(bundle, lang, step),
				});
			} else if (step.op === 'parameter') {
				label = viewMessage(stdPacks, lang, 'route.calc.parameter', {
					parameter: calcLeafLabel(bundle, lang, step),
				});
			} else if (step.op === 'rule') {
				label = viewMessage(stdPacks, lang, 'route.calc.rule', {
					rule: calcLeafLabel(bundle, lang, step),
				});
			} else {
				label = viewMessage(stdPacks, lang, 'route.calc.op', { op: step.op });
			}

			let origin: string;
			let originSign: SignInfo | undefined;
			if (!step.relation) {
				origin = ruleLabel;
				originSign = signByName(catalog, 'derived');
			} else if (matchedNode) {
				const originInfo = formatOrigin(
					bundle,
					lang,
					stdPacks,
					catalog,
					matchedNode,
					answer,
					'positive',
				);
				origin = originInfo.origin;
				originSign = originInfo.originSign;
			} else {
				origin = labelOf(bundle, lang, step.relation);
			}

			lines.push({
				index: lines.length,
				relation: stepRelation,
				key: stepKey,
				depth,
				polarity: 'positive',
				path: step.path,
				label,
				value,
				state,
				reason,
				valueSign,
				origin,
				originSign,
				verbs: [],
			});
		}
	} else {
		const directSteps = steps.filter(
			(s) => s.conclusion.relation === start.relation && s.conclusion.key === start.key,
		);
		const stepsByPremise = new Map<string, GroundsStep[]>();
		for (const step of directSteps) {
			const id = rowId(step.premise.relation, step.premise.key);
			const list = stepsByPremise.get(id);
			if (list) list.push(step);
			else stepsByPremise.set(id, [step]);
		}

		const rawAggregates = ((witness?.aggregates ?? []) as unknown as AggregateWitnessLike[]).map(
			(agg, idx) => ({ agg, pos: typeof agg.position === 'number' ? agg.position : idx }),
		);
		const aggByPos = new Map<number, AggregateWitnessLike>();
		for (const { agg, pos } of rawAggregates) {
			aggByPos.set(pos, agg);
		}

		const emittedAggs = new Set<number>();

		const emitTotal = (aggPos: number, fallbackRelation: string): number => {
			const agg = aggByPos.get(aggPos);
			const relation = agg?.relation ?? fallbackRelation;
			const parsed = parseStateValue(agg?.result ?? '');
			const sep = viewMessage(stdPacks, lang, 'name.separator');
			const totalLabel =
				viewMessage(stdPacks, lang, 'waterfall.total') + sep + labelOf(bundle, lang, relation);
			const value =
				parsed.state === 'known'
					? parsed.value
					: formatNonKnownText(bundle, stdPacks, lang, parsed.state, parsed.reason);
			const index = lines.length;
			lines.push({
				index,
				relation,
				key: agg?.group_key ?? '[]',
				depth: 0,
				polarity: 'positive',
				part: 'total',
				label: totalLabel,
				value,
				state: parsed.state,
				reason: parsed.reason,
				valueSign: stateSign(catalog, parsed.state),
				origin: witness ? labelOf(bundle, lang, witness.rule_id) : '',
				originSign: signByName(catalog, 'derived'),
				verbs: [],
			});
			aggPosToLine.set(aggPos, index);
			emittedAggs.add(aggPos);
			return index;
		};

		// Keep distance-1 nodes from the route answer in exact answer order: none added, none dropped.
		const distanceOne = answer.nodes.filter((n) => n.distance === 1 && !n.outside);
		for (const node of distanceOne) {
			const nodeSteps = stepsByPremise.get(rowId(node.relation, node.key)) ?? [];
			const premiseSteps = nodeSteps.filter((s) => s.how === 'positive' || s.how === 'negative');
			const contribStep = nodeSteps.find((s) => s.how === 'contributes');
			const keyParts = parseKey(node.key);

			if (contribStep && premiseSteps.length === 0) {
				if (!emittedAggs.has(contribStep.position)) {
					emitTotal(contribStep.position, node.relation);
				}
				const index = lines.length;
				const polarity: 'positive' | 'negative' = 'positive';
				const formatted = formatLineValue(
					bundle,
					lang,
					stdPacks,
					catalog,
					node.relation,
					keyParts,
					polarity,
					contribStep.value,
				);
				const originInfo = formatOrigin(bundle, lang, stdPacks, catalog, node, answer, polarity);
				lines.push({
					index,
					relation: node.relation,
					key: node.key,
					depth: 1,
					polarity,
					label: formatLineLabel(bundle, lang, stdPacks, node.relation, keyParts, polarity),
					value: formatted.value,
					state: formatted.state,
					reason: formatted.reason,
					valueSign: formatted.valueSign,
					origin: originInfo.origin,
					originSign: originInfo.originSign,
					verbs: [],
				});
				continue;
			}

			const primary = premiseSteps[0];
			const polarity: 'positive' | 'negative' =
				primary?.how === 'negative' ? 'negative' : 'positive';
			const index = lines.length;
			for (const step of premiseSteps) {
				if (!atomPosToLine.has(step.position)) {
					atomPosToLine.set(step.position, index);
				}
			}
			const formatted = formatLineValue(
				bundle,
				lang,
				stdPacks,
				catalog,
				node.relation,
				keyParts,
				polarity,
				primary?.value,
			);
			const originInfo = formatOrigin(bundle, lang, stdPacks, catalog, node, answer, polarity);
			lines.push({
				index,
				relation: node.relation,
				key: node.key,
				depth: 0,
				polarity,
				label: formatLineLabel(bundle, lang, stdPacks, node.relation, keyParts, polarity),
				value: formatted.value,
				state: formatted.state,
				reason: formatted.reason,
				valueSign: formatted.valueSign,
				origin: originInfo.origin,
				originSign: originInfo.originSign,
				verbs: [],
			});
		}

		// Emit totals for any aggregates with zero contributing rows in the answer.
		for (const { agg, pos } of rawAggregates) {
			if (!emittedAggs.has(pos)) {
				emitTotal(pos, agg.relation);
			}
		}
	}

	// Map each variable bound by a rule body atom or aggregate to its slip line index.
	const varToLine = new Map<string, number>();
	let atomIndex = 0;
	let aggIndex = 0;
	for (const literal of rule?.body ?? []) {
		if (literal.kind === 'atom') {
			const pos = atomIndex++;
			if (literal.polarity === 'positive') {
				const lineIndex = atomPosToLine.get(pos);
				if (lineIndex !== undefined) {
					for (const term of literal.terms ?? []) {
						if (term.kind === 'variable' && typeof term.value === 'string') {
							const name = stripQuestionPrefix(term.value);
							if (!varToLine.has(name)) {
								varToLine.set(name, lineIndex);
							}
						}
					}
				}
			}
		} else if (literal.kind === 'aggregate') {
			const pos = aggIndex++;
			const lineIndex = aggPosToLine.get(pos);
			if (
				lineIndex !== undefined &&
				literal.result?.kind === 'variable' &&
				typeof literal.result.value === 'string'
			) {
				const name = stripQuestionPrefix(literal.result.value);
				if (!varToLine.has(name)) {
					varToLine.set(name, lineIndex);
				}
			}
		}
	}

	let sentence: SentenceSegment[];
	if (witness) {
		const args: Record<string, string> = {};
		for (const binding of witness.bindings ?? []) {
			args[stripQuestionPrefix(binding.variable)] = binding.value;
		}
		const messageId = rule?.message ?? `rule.${witness.rule_id}`;
		const parts = fillParts(bundle.messages, lang, messageId, args);
		if (parts !== undefined) {
			sentence = parts.map((part) => {
				if (part.kind === 'var') {
					const target = varToLine.get(part.name);
					if (target !== undefined) {
						return { text: part.text, line: target };
					}
				}
				return { text: part.text };
			});
		} else {
			sentence = [{ text: witness.rule_id }];
		}
	} else if (calcWitness) {
		const ruleLabel = labelOf(bundle, lang, calcWitness.rule);
		const resultText =
			calcWitness.state === 'known'
				? (calcWitness.value ?? '')
				: formatNonKnownText(
						bundle,
						stdPacks,
						lang,
						calcWitness.state as ValueState,
						calcWitness.reason ?? '',
					);
		sentence = [
			{
				text: viewMessage(stdPacks, lang, 'route.calc.none', {
					rule: ruleLabel,
					value: resultText,
				}),
			},
		];
	} else {
		const relLabel = labelOf(bundle, lang, row.relation);
		const sep = viewMessage(stdPacks, lang, 'value.separator');
		sentence = [
			{
				text: viewMessage(stdPacks, lang, 'lead.row', {
					relation: relLabel,
					row: row.key.join(sep),
				}),
			},
		];
	}

	return {
		kind: 'slip',
		lang,
		pack,
		manifestId: head.id,
		head,
		row,
		sentence,
		lines,
		relations: bundle.relations.map((rel) => ({
			id: rel.id,
			label: labelOf(bundle, lang, rel.id),
		})),
		seal: buildSeal(head, lang, stdPacks, catalog),
		headers: buildHeaders(lang, stdPacks),
		legendHeaders: buildLegendHeaders(lang, stdPacks),
		signCatalog: catalog,
		supposedSign: signByName(catalog, 'supposed'),
		labels: {
			relationsHeading: viewMessage(stdPacks, lang, 'row.relations'),
			closeAnswer: viewMessage(stdPacks, lang, 'answer.close'),
		},
		answersByKey: {},
		foldsByVariant: {},
	};
}

function resolveSweepTable(
	bundle: RoleBundleResponse,
	kindId: string,
	slotName: string,
): string | undefined {
	const byId = new Map(bundle.kinds.map((k) => [k.id, k]));
	const seen = new Set<string>();
	let current = byId.get(kindId);
	while (current && !seen.has(current.id)) {
		seen.add(current.id);
		const slot = bundle.attributes.find((a) => a.kind === current!.id && a.name === slotName);
		if (slot) return slot.table;
		current = current.parent ? byId.get(current.parent) : undefined;
	}
	return undefined;
}

const VALID_STOP_STATUSES = new Set<SweepStopStatus>([
	'green',
	'warning',
	'red',
	'not_computed',
	'unavailable',
]);

const VALID_TURN_STATUSES = new Set<SweepTurnStatus>(['turns', 'same', 'unknown']);

interface DifferenceEntryLike {
	relation: string;
	key: string;
	change: string;
	was?: string;
}

async function fetchVariantDifference(
	fetchFn: FetchLike,
	pack: string,
	manifestId: string,
	deltaTerm: string,
	variantId: string,
): Promise<DifferenceEntryLike[] | undefined> {
	const entries: DifferenceEntryLike[] = [];
	let after: string | undefined;
	const MAX_PAGES = 50;
	for (let page = 0; page < MAX_PAGES; page++) {
		let path =
			`/${encodeURIComponent(pack)}/${encodeURIComponent(manifestId)}` +
			`/ask/${encodeURIComponent(deltaTerm)}` +
			`?variant=${encodeURIComponent(variantId)}`;
		if (after !== undefined) {
			path += `&after=${encodeURIComponent(after)}`;
		}
		const res = await fetchJson<ExplainAnswer>(fetchFn, path);
		if (res.status !== 200 || !res.body?.difference) {
			return undefined;
		}
		for (const entry of res.body.difference.entries ?? []) {
			entries.push(entry);
		}
		if (!res.body.next) {
			break;
		}
		after = res.body.next;
	}
	return entries;
}

function computeFoldsForLines(
	bundle: RoleBundleResponse,
	stdPacks: StdPacks,
	lang: string,
	catalog: readonly SignInfo[],
	lines: readonly SlipLine[],
	entries: readonly DifferenceEntryLike[],
): Record<number, LineFold> {
	const folds: Record<number, LineFold> = {};
	const calcRelations = new Set(
		bundle.relations.filter((rel) => typeof rel.calc === 'string' && rel.calc.length > 0).map((r) => r.id),
	);

	for (const line of lines) {
		if (line.part === 'total') continue;

		const changed = entries.find(
			(e) => e.change === 'changed' && e.relation === line.relation && e.was === line.key,
		);
		if (changed) {
			const newParts = parseKey(changed.key);
			const wasParts = parseKey(line.key);
			if (line.path !== undefined && wasParts.length === newParts.length && newParts.length >= 2) {
				const parsed = parseStateValue(newParts[newParts.length - 1] ?? '');
				const newValue =
					parsed.state === 'known'
						? parsed.value
						: formatNonKnownText(bundle, stdPacks, lang, parsed.state, parsed.reason);
				folds[line.index] = {
					oldValue: line.value,
					newValue,
					newState: parsed.state,
					newReason: parsed.reason,
					newSign: stateSign(catalog, parsed.state),
				};
			} else {
				const formatted = formatLineValue(
					bundle,
					lang,
					stdPacks,
					catalog,
					line.relation,
					newParts,
					'positive',
					undefined,
				);
				folds[line.index] = {
					oldValue: line.value,
					newValue: formatted.value,
					newState: formatted.state,
					newReason: formatted.reason,
					newSign: formatted.valueSign,
				};
			}
			continue;
		}

		if (calcRelations.has(line.relation)) {
			const removed = entries.find(
				(e) => e.change === 'removed' && e.relation === line.relation && e.key === line.key,
			);
			if (removed) {
				const subject = parseKey(line.key)[0];
				const addedMatches = entries.filter(
					(e) =>
						e.change === 'added' &&
						e.relation === line.relation &&
						parseKey(e.key)[0] === subject,
				);
				if (addedMatches.length === 1) {
					const parts = parseKey(addedMatches[0]!.key);
					if (parts.length === 4) {
						const state = parts[2] as ValueState;
						const reason = state === 'known' ? '' : (parts[3] ?? '');
						const newValue =
							state === 'known'
								? (parts[1] ?? '')
								: formatNonKnownText(bundle, stdPacks, lang, state, reason);
						folds[line.index] = {
							oldValue: line.value,
							newValue,
							newState: state,
							newReason: reason,
							newSign: stateSign(catalog, state),
						};
						continue;
					}
				}
			}
		}

		if (line.polarity === 'positive') {
			const removed = entries.find(
				(e) => e.change === 'removed' && e.relation === line.relation && e.key === line.key,
			);
			if (removed) {
				folds[line.index] = {
					oldValue: line.value,
					newValue: formatNonKnownText(bundle, stdPacks, lang, 'absent', ''),
					newState: 'absent',
					newReason: '',
					newSign: stateSign(catalog, 'absent'),
				};
			}
		} else {
			const added = entries.find(
				(e) => e.change === 'added' && e.relation === line.relation && e.key === line.key,
			);
			if (added) {
				const newParts = parseKey(added.key);
				const formatted = formatLineValue(
					bundle,
					lang,
					stdPacks,
					catalog,
					line.relation,
					newParts,
					'positive',
					undefined,
				);
				folds[line.index] = {
					oldValue: line.value,
					newValue: formatted.value,
					newState: formatted.state,
					newReason: formatted.reason,
					newSign: formatted.valueSign,
				};
			}
		}
	}

	return folds;
}

async function populateLineSweeps(
	fetchFn: FetchLike,
	bundle: RoleBundleResponse,
	stdPacks: StdPacks,
	view: SlipView,
): Promise<string | undefined> {
	const sweepQuestion = bundle.questions.find((q) => q.start === 'sweep' && q.answer === 'series');
	const supposeVerb = stdPacks.verbs.find((v) => v.verb === 'suppose');
	if (!sweepQuestion || !supposeVerb) {
		return undefined;
	}

	const sweepsRes = await fetchJson<BoundSweepListResponse>(
		fetchFn,
		`/${encodeURIComponent(view.pack)}/sweeps?m=${encodeURIComponent(view.manifestId)}`,
	);
	if (
		sweepsRes.status !== 200 ||
		!sweepsRes.body ||
		sweepsRes.body.manifest_id !== view.manifestId ||
		!Array.isArray(sweepsRes.body.sweeps) ||
		sweepsRes.body.sweeps.length === 0
	) {
		return undefined;
	}

	const startRelation = view.row?.relation;
	const startKey = view.row ? canonicalKey(view.row.key) : undefined;
	const samplesNote = viewMessage(stdPacks, view.lang, 'scale.samples');
	const unavailableNote = viewMessage(stdPacks, view.lang, 'scale.unavailable');

	await Promise.all(
		sweepsRes.body.sweeps.map(async (sweep) => {
			const table = resolveSweepTable(bundle, sweep.cell.kind, sweep.cell.slot);
			if (!table) return;

			const matchedLines = view.lines.filter((line) => {
				if (line.part === 'total' || line.polarity !== 'positive') return false;
				if (line.path !== undefined && line.relation === startRelation && line.key === startKey) {
					return false;
				}
				if (line.relation !== table) return false;
				const parts = parseKey(line.key);
				return parts.length >= 2 && parts[0] === sweep.cell.id;
			});
			if (matchedLines.length === 0) return;

			let sweepPath =
				`/${encodeURIComponent(view.pack)}/${encodeURIComponent(view.manifestId)}` +
				`/ask/${encodeURIComponent(sweepQuestion.term)}` +
				`?sweep=${encodeURIComponent(sweep.name)}`;
			if (startRelation && startKey) {
				sweepPath +=
					`&relation=${encodeURIComponent(startRelation)}` +
					`&key=${encodeURIComponent(startKey)}`;
			}
			const seriesRes = await fetchJson<ExplainAnswer>(fetchFn, sweepPath);
			if (seriesRes.status !== 200 || !seriesRes.body?.series) {
				return;
			}
			const seriesByIndex = new Map(seriesRes.body.series.map((cell) => [cell.index, cell]));

			const stops: SweepStop[] = sweep.cells.map((cell: BoundSweepCellResponse) => {
				// Cartouche: an answer outside the canonical values is refused, not normalised (issue #23 §2). Rezono's page
				// mapped an unknown status to `unavailable`, dropped an unknown turn and rewrote a turn on an unavailable
				// stop to `unknown`.
				if (!VALID_STOP_STATUSES.has(cell.status)) {
					throw new Error(`reader /sweeps: unknown stop status "${String(cell.status)}" at stop ${cell.index}`);
				}
				const status: SweepStopStatus = cell.status;
				const seriesCell = seriesByIndex.get(cell.index);
				let turn: SweepTurnStatus | undefined;
				let causes: string[] | undefined;
				if (seriesCell?.turn !== undefined && seriesCell.turn !== null) {
					if (!VALID_TURN_STATUSES.has(seriesCell.turn)) {
						throw new Error(`reader sweep series: unknown turn "${String(seriesCell.turn)}" at stop ${cell.index}`);
					}
					if (status === 'unavailable' && seriesCell.turn !== 'unknown') {
						throw new Error(`reader sweep series: turn "${seriesCell.turn}" at stop ${cell.index}, which the role cannot see`);
					}
					turn = seriesCell.turn;
					if (turn === 'turns' && Array.isArray(seriesCell.causes)) {
						causes = [...seriesCell.causes];
					}
				}
				const manifest =
					(status === 'green' || status === 'warning') &&
					typeof cell.manifest === 'string' &&
					cell.manifest !== ''
						? cell.manifest
						: undefined;
				const checks =
					status === 'red' && Array.isArray(cell.checks)
						? cell.checks.map((c: SweepCheckInfo) => ({ name: c.name, status: c.status }))
						: undefined;
				return {
					index: cell.index,
					value: cell.value,
					status,
					statusLabel: viewMessage(stdPacks, view.lang, `scale.${status}`),
					...(turn !== undefined ? { turn } : {}),
					...(causes !== undefined ? { causes } : {}),
					...(manifest !== undefined ? { manifest } : {}),
					...(checks !== undefined ? { checks } : {}),
				};
			});

			const allUnavailable = stops.length > 0 && stops.every((s) => s.status === 'unavailable');
			const lineSweep: LineSweep = {
				name: sweep.name,
				stops,
				unavailable: allUnavailable,
				...(allUnavailable ? { unavailableNote } : {}),
				samplesNote,
			};
			for (const line of matchedLines) {
				line.sweep = lineSweep;
			}
		}),
	);

	const deltaQuestion =
		bundle.questions.find(
			(q) =>
				q.start === 'delta' &&
				q.answer === 'overlay' &&
				q.steps.length === 1 &&
				q.steps[0]?.suppose?.delta === 'given',
		) ?? bundle.questions.find((q) => q.start === 'delta' && q.answer === 'overlay');

	if (deltaQuestion) {
		// Cartouche: every variant a stop names is read now, at build time, and its folds computed once; Rezono's
		// page did this per picked stop in the browser (loadVariantFolds).
		const variants: string[] = [];
		for (const line of view.lines) {
			for (const stop of line.sweep?.stops ?? []) {
				if (stop.manifest !== undefined && !variants.includes(stop.manifest)) variants.push(stop.manifest);
			}
		}
		for (const variantId of variants) {
			const entries = await fetchVariantDifference(
				fetchFn,
				view.pack,
				view.manifestId,
				deltaQuestion.term,
				variantId,
			);
			view.foldsByVariant[variantId] = entries
				? computeFoldsForLines(bundle, stdPacks, view.lang, view.signCatalog, view.lines, entries)
				: {};
		}
	}

	return sweepQuestion.term;
}

async function fetchJson<T>(fetchFn: FetchLike, url: string): Promise<{ status: number; body?: T }> {
	const response = await fetchFn(url);
	if (!response.ok) {
		return { status: response.status };
	}
	const body = (await response.json()) as T;
	return { status: response.status, body };
}

async function resolveHomeRow(
	fetchFn: FetchLike,
	pack: string,
	manifestId: string,
	bundle: RoleBundleResponse,
): Promise<RowSelection | undefined> {
	for (const relation of bundle.home?.claim ?? []) {
		const path = `/${encodeURIComponent(pack)}/${encodeURIComponent(manifestId)}/rows/${encodeURIComponent(relation)}?limit=2`;
		const res = await fetchJson<{ rows: Array<{ key: string[] }>; next?: string[] }>(fetchFn, path);
		if (res.status === 200 && res.body && res.body.rows.length === 1 && !res.body.next) {
			return { relation, key: res.body.rows[0]!.key };
		}
	}
	return undefined;
}

async function populateLineVerbs(
	fetchFn: FetchLike,
	bundle: RoleBundleResponse,
	stdPacks: StdPacks,
	view: SlipView,
	sweepQuestionTerm?: string,
): Promise<void> {
	const startRelation = view.row?.relation;
	const startKey = view.row ? canonicalKey(view.row.key) : undefined;
	const questionsByTerm = new Map(bundle.questions.map((q) => [q.term, q]));

	await Promise.all(
		view.lines.map(async (line) => {
			if (line.part === 'total') return;
			// An operator step of a calculation refers to the slip's own row, not a separate premise row.
			if (line.path !== undefined && line.relation === startRelation && line.key === startKey) {
				return;
			}
			const results = await Promise.all(
				stdPacks.verbs.map(async (verb) => {
					if (verb.verb === 'suppose') {
						if (!line.sweep || !sweepQuestionTerm) return undefined;
						const lineVerb: LineVerb = {
							verb: verb.verb,
							label: viewMessage(stdPacks, view.lang, verb.label_message),
							key: verb.key,
							question: sweepQuestionTerm,
							answerShape: 'series',
							primary: verb.primary,
						};
						return { lineVerb, table: undefined as AnswerTable | undefined };
					}
					if (!verb.question) return undefined;
					const question = questionsByTerm.get(verb.question);
					if (!question) return undefined;
					if (question.start === 'present' && line.polarity !== 'positive') return undefined;
					if (question.start === 'absent' && line.polarity !== 'negative') return undefined;
					if (question.start !== 'present' && question.start !== 'absent') return undefined;

					const path =
						`/${encodeURIComponent(view.pack)}/${encodeURIComponent(view.manifestId)}` +
						`/ask/${encodeURIComponent(question.term)}` +
						`?relation=${encodeURIComponent(line.relation)}&key=${encodeURIComponent(line.key)}`;
					const res = await fetchJson<ExplainAnswer>(fetchFn, path);
					if (res.status !== 200 || !res.body) {
						return undefined;
					}
					const lineVerb: LineVerb = {
						verb: verb.verb,
						label: viewMessage(stdPacks, view.lang, verb.label_message),
						key: verb.key,
						question: question.term,
						answerShape: question.answer,
						primary: verb.primary,
					};
					const table = buildAnswerTable(
						bundle,
						stdPacks,
						view.lang,
						question.term,
						question.answer,
						res.body,
						view.signCatalog,
					);
					return { lineVerb, table };
				}),
			);

			const verbs: LineVerb[] = [];
			for (const result of results) {
				if (!result) continue;
				verbs.push(result.lineVerb);
				if (result.table) {
					view.answersByKey[`${line.index}:${result.lineVerb.verb}`] = result.table;
				}
			}
			line.verbs = verbs;
		}),
	);
}

export async function loadSlip(
	fetchFn: FetchLike,
	options: { pack: string; lang: string; row?: RowSelection | undefined },
	stdPacks: StdPacks,
	messages?: MessageFiller,
): Promise<SlipView> {
	if (messages) useMessageFiller(messages);
	const { pack, lang } = options;
	const catalog = buildSignCatalog(stdPacks, lang);
	const headRes = await fetchJson<HeadResponse>(fetchFn, `/${encodeURIComponent(pack)}/head`);
	if (headRes.status !== 200 || !headRes.body) {
		throw new Error(`Unable to read head for ${pack} (${headRes.status})`);
	}
	const head = headRes.body;
	const bundleRes = await fetchJson<RoleBundleResponse>(
		fetchFn,
		`/${encodeURIComponent(pack)}/bundle?m=${encodeURIComponent(head.id)}`,
	);
	if (bundleRes.status !== 200 || !bundleRes.body) {
		throw new Error(`Unable to read bundle for ${pack} (${bundleRes.status})`);
	}
	const bundle = bundleRes.body;

	const selectedRow = options.row ?? (await resolveHomeRow(fetchFn, pack, head.id, bundle));
	if (!selectedRow) {
		return {
			kind: 'relations',
			lang,
			pack,
			manifestId: head.id,
			head,
			sentence: [],
			lines: [],
			relations: bundle.relations.map((rel) => ({
				id: rel.id,
				label: labelOf(bundle, lang, rel.id),
			})),
			seal: buildSeal(head, lang, stdPacks, catalog),
			headers: buildHeaders(lang, stdPacks),
			legendHeaders: buildLegendHeaders(lang, stdPacks),
			signCatalog: catalog,
			labels: {
				relationsHeading: viewMessage(stdPacks, lang, 'row.relations'),
				closeAnswer: viewMessage(stdPacks, lang, 'answer.close'),
			},
			answersByKey: {},
			foldsByVariant: {},
		};
	}

	const routeQuestion = bundle.questions.find(
		(q) => q.start === 'present' && q.answer === 'route',
	);
	if (!routeQuestion) {
		throw new Error(`No route question available for ${pack}`);
	}

	const keyText = canonicalKey(selectedRow.key);
	const routePath =
		`/${encodeURIComponent(pack)}/${encodeURIComponent(head.id)}` +
		`/ask/${encodeURIComponent(routeQuestion.term)}` +
		`?relation=${encodeURIComponent(selectedRow.relation)}&key=${encodeURIComponent(keyText)}`;
	const routeRes = await fetchJson<ExplainAnswer>(fetchFn, routePath);
	if (routeRes.status !== 200 || !routeRes.body) {
		throw new Error(`Unable to read proof for ${selectedRow.relation} (${routeRes.status})`);
	}

	const view = buildRuleSlipView(pack, lang, head, bundle, selectedRow, routeRes.body, stdPacks);
	const sweepQuestionTerm = await populateLineSweeps(fetchFn, bundle, stdPacks, view);
	await populateLineVerbs(fetchFn, bundle, stdPacks, view, sweepQuestionTerm);
	return view;
}
