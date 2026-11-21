/**
 * Pure Zero-Dependency Validators for Cartouche's Four Frozen Wave-0 Contracts (Decision 0007):
 *  1. contracts/cartouche-scene.v2.schema.json  (CartoucheScene v2 IR + xD-Discipline + Geometry)
 *  2. contracts/data-marks.json                 (DOM & SVG data-* test anchors)
 *  3. contracts/server-projections.schema.json  (5 Minimal Server Projections + 8 Golden Fixtures)
 *  4. contracts/std-view.v2.tokens.json         (std-view v2 perceptual OKLCH tokens, signs & verbs)
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DIGIT_RE = /[0-9]/;
const OKLCH_RE = /^oklch\(\s*(0(?:\.\d+)?|1(?:\.0+)?)\s+(0(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*\)$/;
const HEX_RE = /^#[0-9a-f]{6}$/;
const DATA_ATTR_RE = /^data-[a-z0-9-]+$/;

export function sha256Normalized(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function loadJson(rootDir, relPath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relPath), 'utf8'));
}

export function validateFreezeLock(rootDir, lockObj) {
  const errors = [];
  if (!lockObj || lockObj.lock_version !== 'cartouche.freeze-lock/1') {
    errors.push('contracts/freeze-lock.json must declare lock_version === "cartouche.freeze-lock/1".');
    return errors;
  }
  const requiredFiles = [
    'contracts/cartouche-scene.v2.schema.json',
    'contracts/data-marks.json',
    'contracts/server-projections.schema.json',
    'contracts/std-view.v2.tokens.json',
    'contracts/rezono-pin.json'
  ];
  for (const rel of requiredFiles) {
    const entry = lockObj.contracts?.[rel];
    if (!entry) {
      errors.push(`freeze-lock missing required entry for "${rel}".`);
      continue;
    }
    const full = path.join(rootDir, rel);
    if (!fs.existsSync(full)) {
      errors.push(`frozen contract file missing on disk: "${rel}".`);
      continue;
    }
    const actual = sha256Normalized(full);
    if (actual !== entry.sha256) {
      errors.push(
        `FROZEN CONTRACT TAMPERED: "${rel}" sha256 mismatch (expected ${entry.sha256.slice(0, 12)}…, got ${actual.slice(0, 12)}…). Worker PRs must not modify frozen contracts without a planner decision bump.`
      );
    }
  }
  return errors;
}

export function parseOklch(value) {
  const m = typeof value === 'string' ? value.match(OKLCH_RE) : null;
  if (!m) return null;
  const L = Number.parseFloat(m[1]);
  const C = Number.parseFloat(m[2]);
  const H = Number.parseFloat(m[3]);
  if (L < 0 || L > 1 || C < 0 || C > 0.4 || H < 0 || H > 360) return null;
  return { L, C, H };
}

export function validateStdViewTokensContract(tokensContract, pkgExports, specimenEntries) {
  const errors = [];
  if (tokensContract.contract_id !== 'rezono.std-view-tokens/2') {
    errors.push(`std-view.v2.tokens.json contract_id mismatch: ${tokensContract.contract_id}`);
  }

  const requiredTokens = Object.keys(tokensContract.css_vars ?? {});
  if (requiredTokens.length !== 15) {
    errors.push(`std-view.v2.tokens.json expected 15 CSS tokens, got ${requiredTokens.length}.`);
  }

  const guarantees = tokensContract.contrast_guarantees;
  const paletteNames = ['swisstopo', 'obsidian', 'forced'];

  for (const name of paletteNames) {
    const spec = tokensContract.palettes?.[name];
    if (!spec) {
      errors.push(`Missing palette "${name}" in std-view.v2.tokens.json.`);
      continue;
    }
    const pkgPalette = pkgExports.PALETTES?.[name];
    if (!pkgPalette) {
      errors.push(`packages/reader-core PALETTES missing "${name}".`);
      continue;
    }

    for (const key of requiredTokens) {
      const val = spec.tokens?.[key];
      if (typeof val !== 'string' || val.length === 0) {
        errors.push(`Palette "${name}" missing token "${key}".`);
        continue;
      }
      if (spec.color_space === 'oklch') {
        if (!parseOklch(val)) {
          errors.push(`Palette "${name}" token "${key}" is not valid OKLCH: "${val}".`);
        }
      } else if (spec.color_space === 'srgb-hex') {
        if (!HEX_RE.test(val)) {
          errors.push(`Palette "${name}" token "${key}" is not valid #rrggbb hex: "${val}".`);
        }
      }
      if (pkgPalette[key] !== val) {
        errors.push(`Token drift in packages/reader-core PALETTES.${name}.${key}: TS="${pkgPalette[key]}" vs JSON="${val}".`);
      }
    }

    // Perceptual OKLCH contrast checks
    if (spec.color_space === 'oklch') {
      const paper = parseOklch(spec.tokens.paper);
      const ink = parseOklch(spec.tokens.ink);
      const inkSoft = parseOklch(spec.tokens.inkSoft);
      if (paper && ink && Math.abs(ink.L - paper.L) < guarantees.min_oklch_delta_L_ink_paper) {
        errors.push(`Palette "${name}" ink/paper lightness separation below ${guarantees.min_oklch_delta_L_ink_paper}.`);
      }
      if (paper && inkSoft && Math.abs(inkSoft.L - paper.L) < guarantees.min_oklch_delta_L_inkSoft_paper) {
        errors.push(`Palette "${name}" inkSoft/paper lightness separation below ${guarantees.min_oklch_delta_L_inkSoft_paper}.`);
      }
      for (const sem of guarantees.semantic_tokens ?? []) {
        const parsed = parseOklch(spec.tokens[sem]);
        if (paper && parsed && Math.abs(parsed.L - paper.L) < guarantees.min_oklch_delta_L_semantic_paper) {
          errors.push(`Palette "${name}" semantic token "${sem}" lightness separation below ${guarantees.min_oklch_delta_L_semantic_paper}.`);
        }
      }
    }
  }

  // Signs & non-color uniqueness check + drift check against reader-core SIGNS and atlas SPECIMEN_ENTRIES
  const seenGlyphs = new Map();
  const tokenSet = new Set(requiredTokens);
  for (const [signKey, signSpec] of Object.entries(tokensContract.signs ?? {})) {
    if (!signSpec.glyph || typeof signSpec.glyph !== 'string') {
      errors.push(`Sign "${signKey}" missing non-color glyph.`);
    } else if (seenGlyphs.has(signSpec.glyph)) {
      errors.push(`Duplicate glyph "${signSpec.glyph}" shared by "${signKey}" and "${seenGlyphs.get(signSpec.glyph)}".`);
    } else {
      seenGlyphs.set(signSpec.glyph, signKey);
    }
    if (!tokenSet.has(signSpec.token)) {
      errors.push(`Sign "${signKey}" references unknown token "${signSpec.token}".`);
    }
    const pkgSign = pkgExports.SIGNS?.[signKey];
    if (!pkgSign || pkgSign.glyph !== signSpec.glyph || pkgSign.pattern !== signSpec.pattern || pkgSign.token !== signSpec.token) {
      errors.push(`Sign drift between std-view.v2.tokens.json and packages/reader-core SIGNS["${signKey}"].`);
    }
  }
  if (Object.keys(pkgExports.SIGNS ?? {}).length !== Object.keys(tokensContract.signs ?? {}).length) {
    errors.push('SIGNS key count mismatch between packages/reader-core and std-view.v2.tokens.json.');
  }

  // Cross-check Specimen oracle glyphs against frozen std-view signs
  for (const entry of specimenEntries ?? []) {
    if (entry.kind === 'trust_tier') continue;
    const signName = entry.dataEntry.split(':')[1];
    const frozen = tokensContract.signs?.[signName];
    if (!frozen) {
      errors.push(`Specimen entry "${entry.dataEntry}" references unknown sign "${signName}".`);
    } else if (frozen.glyph !== entry.glyph) {
      errors.push(`Specimen glyph drift for "${entry.dataEntry}": specimen="${entry.glyph}" vs frozen="${frozen.glyph}".`);
    }
  }

  // Verbs sync check
  const jsonVerbs = tokensContract.verbs ?? [];
  const pkgVerbs = pkgExports.STD_VERBS ?? [];
  if (JSON.stringify(jsonVerbs) !== JSON.stringify(pkgVerbs)) {
    errors.push('STD_VERBS drift between packages/reader-core and contracts/std-view.v2.tokens.json.');
  }

  return errors;
}

export function validateDataMarksContract(marksContract, tokensContract, pkgDataMarks) {
  const errors = [];
  if (marksContract.contract_id !== 'cartouche.data-marks/1') {
    errors.push(`data-marks.json contract_id mismatch: ${marksContract.contract_id}`);
  }

  const attrs = marksContract.attributes ?? {};
  const attrNames = new Set();
  for (const [key, spec] of Object.entries(attrs)) {
    if (!DATA_ATTR_RE.test(spec.attr ?? '')) {
      errors.push(`data-marks attribute "${key}" has invalid attr name "${spec.attr}".`);
    }
    if (attrNames.has(spec.attr)) {
      errors.push(`data-marks duplicate attr name "${spec.attr}".`);
    }
    attrNames.add(spec.attr);
    if (pkgDataMarks[key] !== spec.attr) {
      errors.push(`DATA_MARKS drift for "${key}": TS="${pkgDataMarks[key]}" vs JSON="${spec.attr}".`);
    }
  }
  if (Object.keys(pkgDataMarks).length !== Object.keys(attrs).length) {
    errors.push('DATA_MARKS key count mismatch between packages/reader-core and contracts/data-marks.json.');
  }

  // Verify data-sign values match std-view signs 100%
  const markSigns = [...(attrs.sign?.values ?? [])].sort();
  const tokenSigns = Object.keys(tokensContract.signs ?? {}).sort();
  if (JSON.stringify(markSigns) !== JSON.stringify(tokenSigns)) {
    errors.push(`data-marks sign values mismatch std-view signs: ${JSON.stringify(markSigns)} vs ${JSON.stringify(tokenSigns)}`);
  }

  // Verify data-cartouche-theme values match std-view palettes 100%
  const markThemes = [...(attrs.theme?.values ?? [])].sort();
  const tokenThemes = Object.keys(tokensContract.palettes ?? {}).sort();
  if (JSON.stringify(markThemes) !== JSON.stringify(tokenThemes)) {
    errors.push(`data-marks theme values mismatch std-view palettes.`);
  }

  // Verify all required Slip conformance & SVG selectors are present
  const requiredSelectors = [
    'slip_table',
    'sentence',
    'sentence_link',
    'slip_line',
    'total_line',
    'value_cell',
    'verb_button',
    'answer_table',
    'seal',
    'seal_check',
    'manifest_hash',
    'legend_table',
    'legend_sign_row',
    'table_twin',
    'unserved',
    'sweep_stop',
    'fold_old',
    'fold_new',
    'propose_action',
    'svg_mark',
    'svg_drift'
  ];
  for (const sel of requiredSelectors) {
    if (typeof marksContract.selectors?.[sel] !== 'string' || marksContract.selectors[sel].length === 0) {
      errors.push(`data-marks.json missing required selector "${sel}".`);
    }
  }

  return errors;
}

export function validateSceneContractSync(sceneContract, xdLawCodes, geomInvariantCodes) {
  const errors = [];
  if (sceneContract.x_contract?.id !== 'cartouche.scene-ir/2') {
    errors.push(`cartouche-scene.v2.schema.json x_contract.id mismatch.`);
  }
  const schemaXdCodes = (sceneContract.x_discipline_laws ?? []).map((l) => l.code);
  if (JSON.stringify(schemaXdCodes) !== JSON.stringify([...xdLawCodes])) {
    errors.push(`xD-Discipline law code drift: schema=${JSON.stringify(schemaXdCodes)} vs TS=${JSON.stringify([...xdLawCodes])}`);
  }
  const schemaGeomCodes = (sceneContract.x_geometric_invariants ?? []).map((g) => g.code);
  if (JSON.stringify(schemaGeomCodes) !== JSON.stringify([...geomInvariantCodes])) {
    errors.push(`Geometric invariant code drift: schema=${JSON.stringify(schemaGeomCodes)} vs TS=${JSON.stringify([...geomInvariantCodes])}`);
  }
  return errors;
}

export function validateSceneShape(scene, sceneContract) {
  const errors = [];
  const props = sceneContract.properties;
  if (scene.schemaVersion !== props.schemaVersion.const) {
    errors.push(`Scene schemaVersion must be "${props.schemaVersion.const}", got "${scene.schemaVersion}".`);
  }
  if (!props.archetype.enum.includes(scene.archetype)) {
    errors.push(`Invalid scene archetype "${scene.archetype}".`);
  }
  if (!props.projection.enum.includes(scene.projection)) {
    errors.push(`Invalid scene projection "${scene.projection}".`);
  }
  if (!Array.isArray(scene.axes) || scene.axes.length < 2 || scene.axes.length > 3) {
    errors.push(`Scene axes must contain 2..3 AxisSpec items.`);
  }
  const allowedSigns = new Set(props.usedSigns.items.enum);
  for (const s of scene.usedSigns ?? []) {
    if (!allowedSigns.has(s)) errors.push(`Scene usedSigns contains undeclared sign "${s}".`);
  }
  if (!scene.seal || typeof scene.seal.manifestId !== 'string' || typeof scene.seal.canPropose !== 'boolean') {
    errors.push('Scene seal missing required fields.');
  }
  return errors;
}

function validateOpaqueCell(cell, where, errors) {
  const states = new Set(['known', 'unknown', 'not_applicable', 'invalid', 'absent']);
  if (!cell || typeof cell !== 'object') {
    errors.push(`${where}: expected OpaqueCell object.`);
    return;
  }
  if (!states.has(cell.state)) {
    errors.push(`${where}: invalid state "${cell.state}".`);
  }
  if (typeof cell.proof_ref !== 'string' || cell.proof_ref.trim().length === 0) {
    errors.push(`${where}: missing proof_ref.`);
  }
  if (cell.state === 'known' && (typeof cell.display !== 'string' || cell.display.length === 0)) {
    errors.push(`${where}: known cell must provide non-empty string display.`);
  }
  if (cell.state === 'unknown') {
    if (cell.display !== null && cell.display !== undefined) {
      errors.push(`${where}: unknown cell must have display=null, got "${cell.display}".`);
    }
    if (typeof cell.reason !== 'string' || cell.reason.trim().length === 0) {
      errors.push(`${where}: unknown cell must declare explicit reason.`);
    }
    if (typeof cell.display === 'string' && DIGIT_RE.test(cell.display)) {
      errors.push(`${where}: unknown cell leaked ASCII digit.`);
    }
  }
  if (cell.state === 'absent') {
    if (typeof cell.completeness_witness_ref !== 'string' || cell.completeness_witness_ref.trim().length === 0) {
      errors.push(`${where}: absent cell must carry completeness_witness_ref.`);
    }
  }
  if (cell.state === 'not_applicable' && cell.display !== null && cell.display !== undefined) {
    errors.push(`${where}: not_applicable cell must have display=null.`);
  }
  if (cell.z_norm !== undefined && (typeof cell.z_norm !== 'number' || cell.z_norm < 0 || cell.z_norm > 1)) {
    errors.push(`${where}: z_norm must be a number in [0, 1].`);
  }
}

export function validateFixtureProjection(fixture, projectionContract) {
  const errors = [];
  const fid = fixture?.fixture_id ?? '<unknown>';
  if (typeof fixture?.fixture_id !== 'string' || fixture.fixture_id.length === 0) {
    errors.push('Fixture missing fixture_id.');
    return errors;
  }

  const defs = projectionContract.$defs;
  const validSigns = new Set(defs.EpistemicSign.enum);
  const validLayers = new Set(defs.LayerTag.enum);
  const validTiers = new Set(defs.TrustTier.enum);
  const validGates = new Set(defs.CutSet.properties.gate.enum);

  // Manifest check (optional on 410 unserved fixtures)
  if (fixture.manifest) {
    const m = fixture.manifest;
    if (!/^sha256:[a-f0-9]+$/.test(m.id ?? '')) errors.push(`${fid}.manifest.id must match ^sha256:[a-f0-9]+$.`);
    if (!Number.isInteger(m.epoch) || m.epoch < 0) errors.push(`${fid}.manifest.epoch must be integer >= 0.`);
    if (!validTiers.has(m.trust_tier)) errors.push(`${fid}.manifest.trust_tier invalid: "${m.trust_tier}".`);
    if (!['green', 'failed'].includes(m.witness_check)) errors.push(`${fid}.manifest.witness_check invalid.`);
  } else if (!fixture.unserved) {
    errors.push(`${fid}: fixture without manifest must carry unserved payload.`);
  }

  // Projection 1 & 2: nodes & edges (layer_tag + absent.sweep_witness + cut_set)
  if (Array.isArray(fixture.nodes)) {
    for (const n of fixture.nodes) {
      if (!validSigns.has(n.sign)) errors.push(`${fid}.nodes[${n.id}]: invalid sign "${n.sign}".`);
      if (n.layer !== undefined && !validLayers.has(n.layer)) errors.push(`${fid}.nodes[${n.id}]: invalid layer "${n.layer}".`);
      if (typeof n.proof_ref !== 'string' || !n.proof_ref) errors.push(`${fid}.nodes[${n.id}]: missing proof_ref.`);
      if (n.state === 'absent' && !n.completeness_witness_ref) {
        errors.push(`${fid}.nodes[${n.id}]: absent node missing completeness_witness_ref.`);
      }
      if (n.state === 'unknown') {
        if (n.display !== null && n.display !== undefined) errors.push(`${fid}.nodes[${n.id}]: unknown node must have display=null.`);
        if (!n.reason) errors.push(`${fid}.nodes[${n.id}]: unknown node missing reason.`);
      }
      if (n.cut_set) {
        if (typeof n.cut_set.load_bearing !== 'boolean') errors.push(`${fid}.nodes[${n.id}].cut_set.load_bearing must be boolean.`);
        if (!Number.isInteger(n.cut_set.redundancy_margin) || n.cut_set.redundancy_margin < 0) {
          errors.push(`${fid}.nodes[${n.id}].cut_set.redundancy_margin must be integer >= 0.`);
        }
        if (!validGates.has(n.cut_set.gate)) errors.push(`${fid}.nodes[${n.id}].cut_set.gate invalid.`);
      }
    }
  }

  if (Array.isArray(fixture.edges)) {
    for (const e of fixture.edges) {
      if (!validLayers.has(e.layer)) errors.push(`${fid}.edges[${e.id}]: invalid layer "${e.layer}".`);
      if (e.kind === 'drift') {
        if (!e.stated_proof_ref || !e.observed_proof_ref) {
          errors.push(`${fid}.edges[${e.id}]: drift edge requires BOTH stated_proof_ref and observed_proof_ref.`);
        }
      } else if (e.kind === 'absent') {
        if (!e.completeness_witness_ref) {
          errors.push(`${fid}.edges[${e.id}]: absent edge requires completeness_witness_ref.`);
        }
      } else if (!e.proof_ref) {
        errors.push(`${fid}.edges[${e.id}]: standard edge requires proof_ref.`);
      }
    }
  }

  // Subjects (subsidy / relief)
  if (Array.isArray(fixture.subjects)) {
    for (const s of fixture.subjects) {
      validateOpaqueCell(s.amount_cell, `${fid}.subjects[${s.id}].amount_cell`, errors);
      if (s.income_cell) validateOpaqueCell(s.income_cell, `${fid}.subjects[${s.id}].income_cell`, errors);
      if (s.assets_cell) validateOpaqueCell(s.assets_cell, `${fid}.subjects[${s.id}].assets_cell`, errors);
    }
  }

  // Projection 3: sweep_2d
  if (fixture.sweep_2d) {
    const sw = fixture.sweep_2d;
    if (sw.projection !== 'orthographic') errors.push(`${fid}.sweep_2d.projection must be "orthographic".`);
    if (sw.z_axis?.dim === 'D1' || sw.z_axis?.dim === 'D8') {
      errors.push(`${fid}.sweep_2d.z_axis cannot bind nominal dimension ${sw.z_axis.dim}.`);
    }
    const nx = sw.x_axis?.stops?.length ?? 0;
    const ny = sw.y_axis?.stops?.length ?? 0;
    if (nx < 2 || ny < 2) errors.push(`${fid}.sweep_2d axes require >= 2 stops each.`);
    for (const [i, item] of (sw.cells ?? []).entries()) {
      if (!Number.isInteger(item.ix) || item.ix < 0 || item.ix >= nx) errors.push(`${fid}.sweep_2d.cells[${i}].ix out of range.`);
      if (!Number.isInteger(item.iy) || item.iy < 0 || item.iy >= ny) errors.push(`${fid}.sweep_2d.cells[${i}].iy out of range.`);
      if (typeof item.z_norm !== 'number' || item.z_norm < 0 || item.z_norm > 1) errors.push(`${fid}.sweep_2d.cells[${i}].z_norm out of [0,1].`);
      validateOpaqueCell(item.cell, `${fid}.sweep_2d.cells[${i}].cell`, errors);
    }
    const manifoldSubjects = new Set((sw.unknown_manifolds ?? []).map((m) => m.subject_id));
    for (const sub of fixture.subjects ?? []) {
      if (sub.state === 'unknown' && !manifoldSubjects.has(sub.id)) {
        errors.push(`${fid}.sweep_2d: unknown subject "${sub.id}" missing unknown_manifolds entry.`);
      }
    }
  }

  // Projection 4: bitemporal_grid
  if (fixture.bitemporal_grid) {
    const bt = fixture.bitemporal_grid;
    if (!['2d', 'orthographic'].includes(bt.projection)) errors.push(`${fid}.bitemporal_grid.projection must be 2d or orthographic.`);
    const rows = bt.epochs?.length ?? 0;
    const cols = bt.valid_times?.length ?? 0;
    if (!Array.isArray(bt.matrix) || bt.matrix.length !== rows) {
      errors.push(`${fid}.bitemporal_grid.matrix row count (${bt.matrix?.length}) !== epochs.length (${rows}).`);
    } else {
      for (let r = 0; r < rows; r++) {
        const row = bt.matrix[r];
        if (!Array.isArray(row) || row.length !== cols) {
          errors.push(`${fid}.bitemporal_grid.matrix[${r}] length (${row?.length}) !== valid_times.length (${cols}).`);
          continue;
        }
        for (let c = 0; c < cols; c++) {
          validateOpaqueCell(row[c], `${fid}.bitemporal_grid.matrix[${r}][${c}]`, errors);
          if (c > r && row[c].state !== 'not_applicable') {
            errors.push(`${fid}.bitemporal_grid.matrix[${r}][${c}]: future-knowledge upper triangle cell must be "not_applicable".`);
          }
        }
      }
    }
  }

  // Projection 5: slip_enrichment
  if (fixture.slip_enrichment) {
    const se = fixture.slip_enrichment;
    if (!Array.isArray(se.prism_5) || se.prism_5.length !== 5) {
      errors.push(`${fid}.slip_enrichment.prism_5 must have exactly 5 spectra.`);
    } else {
      const keys = new Set(se.prism_5.map((p) => p.key));
      for (const req of ['norm', 'observed', 'fog', 'cliff', 'role']) {
        if (!keys.has(req)) errors.push(`${fid}.slip_enrichment.prism_5 missing spectrum key "${req}".`);
      }
      for (const p of se.prism_5) {
        if (typeof p.bar_units !== 'number' || p.bar_units < 0 || p.bar_units > 100) {
          errors.push(`${fid}.slip_enrichment.prism_5[${p.key}].bar_units must be in [0,100].`);
        }
      }
    }
    for (const w of se.adjacent_worlds_delta1 ?? []) {
      if (!['repair', 'certainty', 'cliff'].includes(w.sector)) {
        errors.push(`${fid}.slip_enrichment.adjacent_worlds_delta1[${w.id}]: invalid sector "${w.sector}".`);
      }
      if (!w.proof_ref) errors.push(`${fid}.slip_enrichment.adjacent_worlds_delta1[${w.id}]: missing proof_ref.`);
    }
  }

  // Kring live Z-set delta
  if (fixture.live_provisional_delta) {
    const ld = fixture.live_provisional_delta;
    if (!['provisional_checked', 'provisional_engine'].includes(ld.trust_tier)) {
      errors.push(`${fid}.live_provisional_delta.trust_tier invalid.`);
    }
    for (const [i, ch] of (ld.changes ?? []).entries()) {
      if (ch.weight !== 1 && ch.weight !== -1) errors.push(`${fid}.live_provisional_delta.changes[${i}].weight must be 1 or -1.`);
      if (!ch.row?.proof_ref) errors.push(`${fid}.live_provisional_delta.changes[${i}].row missing proof_ref.`);
    }
  }

  // Monge 4D services
  if (Array.isArray(fixture.services)) {
    if (fixture.projection !== 'orthographic') errors.push(`${fid}: Monge fixture requires orthographic projection.`);
    const seenX = new Set();
    const seenY = new Set();
    for (const s of fixture.services) {
      if (seenX.has(s.x)) errors.push(`${fid}.services[${s.id}]: duplicate Monge x=${s.x}.`);
      if (seenY.has(s.y)) errors.push(`${fid}.services[${s.id}]: duplicate Monge y=${s.y}.`);
      seenX.add(s.x);
      seenY.add(s.y);
      if (Array.isArray(fixture.rounds) && s.round_states?.length !== fixture.rounds.length) {
        errors.push(`${fid}.services[${s.id}]: round_states length must equal rounds length.`);
      }
      if (s.state === 'absent' && !s.completeness_witness_ref) {
        errors.push(`${fid}.services[${s.id}]: absent Monge service missing completeness_witness_ref.`);
      }
    }
    for (const arc of fixture.drift_arcs ?? []) {
      if (!arc.stated_proof_ref || !arc.observed_proof_ref) {
        errors.push(`${fid}.drift_arcs[${arc.id}]: requires both stated_proof_ref and observed_proof_ref.`);
      }
    }
  }

  // Unserved 410 payload
  if (fixture.unserved) {
    if (!['publication_withdrawn', 'object_hash_mismatch', 'role_unserved'].includes(fixture.unserved.code)) {
      errors.push(`${fid}.unserved.code invalid.`);
    }
    if (!fixture.unserved.reason_message_id) errors.push(`${fid}.unserved.reason_message_id required.`);
  }

  return errors;
}
