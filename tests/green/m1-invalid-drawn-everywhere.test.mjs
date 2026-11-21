import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS as M } from '../../packages/reader-core/src/index.ts';
import { SPECIMEN_ENTRIES } from '../../packages/atlas/src/index.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

// Decision 0012 §2 (6c), issue #23 §1: `invalid` (`!`) is a sign of Rezono's packs/std-view/key.yaml and Cartouche's
// frozen key, listed in SPECIMEN_ENTRIES, and drawn on every sheet with its published reason and zero digits, never
// as `violated` and never by throwing.

const ROOT = process.cwd();
const fx = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', name), 'utf8'));
const atlas = (file) => path.join(ROOT, 'packages', 'atlas', 'src', file);
const contract = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', name), 'utf8'));
const REASON = 'overflow';

// Each variant turns one published value of the frozen fixture into an invalid one with a published reason.
const SHEETS = [
  {
    name: 'flow-split 01',
    file: 'FlowSplitSheet.svelte',
    props: () => {
      const f = fx('01-platform-drift.json');
      Object.assign(f.nodes[0], { state: 'invalid', reason: REASON });
      return { fixture: f };
    }
  },
  {
    name: 'kringstand 03',
    file: 'KringstandSheet.svelte',
    props: () => {
      const f = fx('03-kring-m1-to-m5-live.json');
      Object.assign(f.sealed_rows[0], { state: 'invalid', reason: REASON });
      return { fixture: f };
    }
  },
  {
    name: 'relief-3d 04',
    file: 'StatutoryRelief3D.svelte',
    props: () => {
      const f = fx('04-subsidy-a001-a003.json');
      f.subjects[0].state = 'invalid';
      f.subjects[0].amount_cell = { state: 'invalid', display: null, reason: REASON, proof_ref: f.subjects[0].amount_cell.proof_ref };
      return { fixture: f };
    }
  },
  {
    name: 'bitemporal-stair 05',
    file: 'BitemporalStairSheet.svelte',
    props: () => {
      const f = fx('05-subsidy-bitemporal.json');
      const cell = f.bitemporal_grid.matrix[0][1];
      f.bitemporal_grid.matrix[0][1] = { state: 'invalid', display: null, reason: REASON, proof_ref: cell.proof_ref };
      return { fixture: f };
    }
  },
  {
    name: 'causal-ripple 06',
    file: 'CausalRippleSheet.svelte',
    props: () => {
      const f = fx('06-keycloak-dense-28.json');
      Object.assign(f.nodes[0], { state: 'invalid', reason: REASON });
      return { fixture: f };
    }
  },
  {
    name: 'monge-fold 08',
    file: 'MongeFoldingSheet.svelte',
    props: () => {
      const f = fx('08-monge-4d-audit.json');
      Object.assign(f.services[0], { state: 'invalid', reason: REASON });
      return { fixture: f, foldAngleDeg: 0 };
    }
  }
];

test('M1 [invalid-drawn-everywhere]: the key defines the invalid sign with the glyph ! and the specimen lists it', () => {
  const tokens = contract('std-view.v2.tokens.json');
  const marks = contract('data-marks.json');
  assert.equal(tokens.signs.invalid?.glyph, '!', 'contracts/std-view.v2.tokens.json signs.invalid has glyph "!" (after Rezono key.yaml has it)');
  assert.ok(marks.attributes.sign.values.includes('invalid'), 'contracts/data-marks.json data-sign values include invalid');
  assert.ok(marks.attributes.state.values.includes('invalid'), 'contracts/data-marks.json data-state values include invalid');
  const entry = SPECIMEN_ENTRIES.find((e) => e.dataEntry.endsWith(':invalid'));
  assert.ok(entry, 'SPECIMEN_ENTRIES lists invalid');
  assert.equal(entry.glyph, '!', 'the specimen draws invalid with "!"');
});

for (const sheet of SHEETS) {
  test(`M1 [invalid-drawn-everywhere]: ${sheet.name} draws an invalid value with !, its reason and no digit`, async () => {
    const { html } = await renderSvelte(atlas(sheet.file), sheet.props());
    const { window, document } = parseHtml(html);
    try {
      const invalid = [...document.querySelectorAll(`[${M.state}="invalid"]`)].filter((el) => !el.closest(`table[${M.part}="legend"]`));
      assert.ok(invalid.length > 0, `${sheet.name}: the invalid value is drawn with data-state="invalid"`);
      for (const el of invalid) {
        const signs = [el, ...el.querySelectorAll(`[${M.sign}]`)].map((s) => s.getAttribute(M.sign)).filter(Boolean);
        assert.ok(signs.includes('invalid'), `${sheet.name}: an invalid mark carries data-sign="invalid", got ${JSON.stringify(signs)}`);
        assert.ok(!signs.includes('violated'), `${sheet.name}: invalid is not drawn as violated`);
        assert.ok(el.textContent.includes('!') || el.querySelector(`[${M.sign}="invalid"]`)?.textContent.includes('!'), `${sheet.name}: the mark shows "!"`);
        assert.equal(/[0-9]/.test(el.textContent), false, `${sheet.name}: an invalid mark shows no digit`);
      }
      assert.ok(
        invalid.some((el) => el.getAttribute(M.reason) === REASON || el.closest(`[${M.reason}]`)?.getAttribute(M.reason) === REASON),
        `${sheet.name}: the published reason is carried as data-reason`
      );
      const legend = document.querySelector(`table[${M.part}="legend"]`);
      assert.ok(legend?.querySelector(`tr[${M.sign}="invalid"]`), `${sheet.name}: the legend lists invalid`);
    } finally {
      await window.happyDOM.close();
    }
  });
}
