import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { render } from '../../packages/slip/bin/render.ts';
import { parseHtml } from '../../scripts/svelte-test-harness.mjs';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0015-quality-round-3.md',
  priority: 1,
  summary: 'N4 (#46 point 5): the slip shows an origin sign only as the reader serves it (none today) and never maps source kind text to a sign; a binding links to a premise by position only, never by matching its value',
  waits_on: []
};

// Green on arrival (Decision 0015 §4): #55 fixed this while the plan was in review; this behavioural check holds the fix
// independently of Decision 0014's green tests, which match source text.
// Decision 0015 §2 N4, issue #46 point 5 (and the law/statute/policy words of point 18). model.ts maps a source's
// `kind` text to an origin sign (originSignForSourceKind). Rezono serves only kind "synthetic", so leaf rows show the
// sign of Cartouche's own mapping. model.ts also links a binding to a premise by matching its value against premise
// keys, which can pick the wrong premise. Fix: take the sign from the reader or show none (rezono-lang/rezono#1451 item
// 4), link by position only, and list both under the reader computations in model.ts.

const ROOT = process.cwd();
const FX10 = 'fixtures/10-slip-reader-answers.json';
const M = DATA_MARKS;
const ORIGIN_SIGNS = ['origin_decision', 'origin_vendor', 'origin_design', 'origin_observation'];
const WHY_ON_GROUP_SIZE = { store: 'main', role: 'reader', pack: 'slip', lang: 'en', row: { relation: 'busy', key: ['group-a'] }, keys: ['w'] };

const loadFx10 = () => JSON.parse(fs.readFileSync(path.join(ROOT, FX10), 'utf8'));

function eachSource(value, fn) {
  if (Array.isArray(value)) value.forEach((v) => eachSource(v, fn));
  else if (value && typeof value === 'object') {
    if (Array.isArray(value.sources)) value.sources.forEach(fn);
    Object.values(value).forEach((v) => eachSource(v, fn));
  }
}

test('M1 [origin-signs-and-bindings-from-reader]: a source kind text never chooses a sign', async () => {
  const kinds = new Set();
  const asServed = loadFx10();
  eachSource(asServed.reader_answers, (s) => kinds.add(s.kind));
  assert.deepEqual([...kinds], ['synthetic'], 'the recording serves sources of kind "synthetic" only');

  const relabelled = loadFx10();
  eachSource(relabelled.reader_answers, (s) => {
    s.kind = 'law';
  });
  const a = await render({ fixture: asServed, ...WHY_ON_GROUP_SIZE });
  const b = await render({ fixture: relabelled, ...WHY_ON_GROUP_SIZE });
  const signs = async (html) => {
    const { window: win, document: doc } = parseHtml(html);
    const out = [...doc.querySelectorAll(`[${M.sign}]`)].map((el) => el.getAttribute(M.sign));
    await win.happyDOM.close();
    return out.join(' ');
  };
  assert.ok(
    b.html === a.html,
    `changing a source kind from "synthetic" to "law" changes the page: Cartouche maps kind text to an origin sign (#46 point 5).\n` +
      `signs as served: ${await signs(a.html)}\nsigns relabelled: ${await signs(b.html)}`
  );
});

test('M1 [origin-signs-and-bindings-from-reader]: leaf rows show no origin sign the reader did not serve', async () => {
  const res = await render({ fixture: FX10, ...WHY_ON_GROUP_SIZE });
  const { window: win, document: doc } = parseHtml(res.html);
  try {
    const tree = doc.querySelector(`table[${M.answer}="grounds"]`);
    assert.ok(tree, 'why opens the grounds table');
    const drawn = [...tree.querySelectorAll(`[${M.sign}]`)].map((el) => el.getAttribute(M.sign)).filter((s) => ORIGIN_SIGNS.includes(s));
    assert.deepEqual(drawn, [], 'leaf rows carry an origin sign Rezono does not serve (Cartouche chose it from kind "synthetic")');
  } finally {
    await win.happyDOM.close();
  }
});

test('M1 [origin-signs-and-bindings-from-reader]: a binding without a position link is not linked by its value', async () => {
  // The rule group_size binds ?g in its body atom `group(?g)` (position 0). Rename that term to ?h: no body position
  // binds ?g any more. ?g's value "group-a" still occurs in the keys of the item__group premises, which are not what
  // ?g names. Linking by position only, ?g has no line.
  const fx = loadFx10();
  const rule = fx.reader_answers.main.reader['/slip/bundle?m=m-1'].body.rules.find((r) => r.id === 'group_size');
  assert.equal(rule.body[0].relation, 'group');
  assert.equal(rule.body[0].terms[0].value, '?g');
  rule.body[0].terms[0].value = '?h';

  const res = await render({ fixture: fx, ...WHY_ON_GROUP_SIZE });
  const { window: win, document: doc } = parseHtml(res.html);
  try {
    const root = doc.querySelector(`table[${M.answer}="grounds"] tbody tr[${M.depth}="0"]`);
    assert.ok(root, 'the conclusion row is drawn');
    const bindings = [...root.querySelectorAll('.proof-bindings li')];
    const g = bindings.find((li) => li.textContent.trim().startsWith('g'));
    assert.ok(g, `the conclusion row lists the binding g: ${bindings.map((li) => li.textContent.trim()).join(' | ')}`);
    const linkedLine = g.querySelector(`a[${M.line}]`)?.getAttribute(M.line) ?? null;
    assert.equal(
      linkedLine,
      null,
      `binding g is linked to line ${linkedLine} because its value "group-a" occurs in that premise key (#46 point 5)`
    );
  } finally {
    await win.happyDOM.close();
  }
});
