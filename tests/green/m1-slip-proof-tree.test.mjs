import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { render } from '../../packages/slip/bin/render.ts';
import { rezonoMessageFiller, rezonoStdPacks } from '../../packages/slip/bin/rezono-source.ts';
import { buildAnswerTable, buildSignCatalog, useMessageFiller } from '../../packages/slip/src/model.ts';
import { rowProofRef } from '../../packages/slip/src/slip-props.ts';
import { auditA11y, parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

const ROOT = process.cwd();
const FX_PATH = 'fixtures/10-slip-reader-answers.json';
const PROOF_TREE = path.join(ROOT, 'packages', 'slip', 'src', 'SlipProofTree.svelte');
const M = DATA_MARKS;
const ORIGIN_SIGNS = new Set(['origin_decision', 'origin_vendor', 'origin_design', 'origin_observation']);

function loadFx10() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, FX_PATH), 'utf8'));
}

/**
 * Compute the exact transitive set of (relation, key, polarity) reachable from
 * the conclusion in a recorded gate `grounds` answer (Decision 0012 §3a point 3).
 */
function transitiveGatePremises(answer) {
  const root = answer.nodes.find((n) => n.distance === 0);
  assert.ok(root, 'gate answer must contain a distance-0 conclusion');
  const byConclusion = new Map();
  for (const step of answer.steps ?? []) {
    const cid = `${step.conclusion.relation}\0${step.conclusion.key}`;
    const list = byConclusion.get(cid) ?? [];
    list.push(step);
    byConclusion.set(cid, list);
  }
  const expected = new Set([`${root.relation}\0${root.key}\0positive`]);
  const visited = new Set([`${root.relation}\0${root.key}`]);
  const queue = [`${root.relation}\0${root.key}`];
  while (queue.length > 0) {
    const cur = queue.shift();
    for (const step of byConclusion.get(cur) ?? []) {
      const pid = `${step.premise.relation}\0${step.premise.key}`;
      const pol = step.how === 'negative' ? 'negative' : 'positive';
      expected.add(`${step.premise.relation}\0${step.premise.key}\0${pol}`);
      if (!visited.has(pid)) {
        visited.add(pid);
        queue.push(pid);
      }
    }
  }
  return expected;
}

function toAnswerProp(table, manifestId = 'm-1') {
  return {
    question: table.question,
    verb: 'why',
    heading: table.heading,
    headers: table.headers,
    rows: table.rows.map((r) => ({
      line: r.line,
      depth: r.depth,
      relation: r.relation,
      key: r.key,
      polarity: r.polarity,
      sentence: r.sentence,
      bindings: r.bindings,
      premiseLinks: r.premiseLinks,
      source: r.source,
      state: r.state,
      reason: r.reason,
      proof_ref: r.relation && r.key ? rowProofRef(manifestId, r.relation, r.key) : undefined,
      cells: r.cells.map((c) => ({ text: c.text, sign: c.sign?.name }))
    }))
  };
}

test('M1 [slip-proof-tree]: opening why renders table[data-answer="grounds"] with depth/relation/key/polarity, gate-driven transitive premises, filled means sentence + bindings, @ source leaves, checker seal & legend', async () => {
  const fx = loadFx10();
  const gsAnswer = fx.reader_answers.main.reader['/slip/m-1/ask/grounds?relation=group_size&key=%5B%22group-a%22%2C%222%22%5D'].body;

  // Open why (w) on the derived line group_size of busy::["group-a"]
  const res = await render({
    fixture: FX_PATH,
    role: 'reader',
    pack: 'slip',
    lang: 'en',
    row: { relation: 'busy', key: ['group-a'] },
    keys: ['w']
  });

  const { window: win, document: doc } = parseHtml(res.html);
  try {
    // 1. table[data-answer="grounds"] with th headers and one tr per distinct reader node in exact reader order
    const tree = doc.querySelector(`table[${M.answer}="grounds"]`);
    assert.ok(tree, 'expected table[data-answer="grounds"]');
    assert.ok(tree.querySelectorAll('thead th').length >= 4, 'proof tree table must have th headers');

    const rows = [...tree.querySelectorAll('tbody tr')];
    assert.equal(rows.length, gsAnswer.nodes.length, 'one tr per distinct proof node in reader answer order');
    for (let i = 0; i < gsAnswer.nodes.length; i++) {
      const tr = rows[i];
      const expected = gsAnswer.nodes[i];
      assert.equal(tr.getAttribute(M.relation), expected.relation);
      assert.equal(tr.getAttribute(M.key), expected.key);
      assert.equal(tr.getAttribute(M.depth), String(expected.distance));
      assert.ok(
        tr.getAttribute(M.polarity) === 'positive' || tr.getAttribute(M.polarity) === 'negative',
        'every proof node row must carry data-polarity'
      );
    }

    // 3. Gate-driven: rendered (relation, key, polarity) set equals transitive witness premises from gate answer
    const renderedSet = new Set(
      rows.map((r) => `${r.getAttribute(M.relation)}\0${r.getAttribute(M.key)}\0${r.getAttribute(M.polarity)}`)
    );
    assert.deepEqual(renderedSet, transitiveGatePremises(gsAnswer), 'rendered rows must equal exact transitive gate premises');

    // 4. Conclusion row (depth 0) shows Rezono-filled means sentence AND witness bindings (variable = value) with a[data-line] links
    const rootRow = rows[0];
    assert.equal(rootRow.getAttribute(M.depth), '0');
    const sentence = rootRow.querySelector(`[${M.part}="sentence"]`);
    assert.ok(sentence, 'conclusion row must show filled [data-part="sentence"]');
    assert.equal(sentence.textContent.replace(/\s+/g, ' ').trim(), 'Group group-a has 2 items.');
    const links = [...sentence.querySelectorAll(`a[${M.line}]`)];
    assert.ok(links.length >= 1, 'filled means sentence variables must link via a[data-line] to premise rows');
    for (const a of links) {
      const targetLine = a.getAttribute(M.line);
      assert.ok(
        rows.some((r) => r.getAttribute(M.line) === targetLine && Number(r.getAttribute(M.depth)) > 0),
        `a[data-line="${targetLine}"] must resolve to a premise row in the proof tree`
      );
    }

    const bindingsEl = rootRow.querySelector('ul');
    assert.ok(bindingsEl, 'conclusion row must list witness bindings in a semantic <ul>');
    const bindingItems = [...bindingsEl.querySelectorAll('li')];
    const witness = gsAnswer.witnesses[0];
    assert.equal(bindingItems.length, witness.bindings.length, 'every published witness binding must be listed');
    for (let i = 0; i < witness.bindings.length; i++) {
      const b = witness.bindings[i];
      const varName = b.variable.replace(/^\?/, '');
      const li = bindingItems[i];
      assert.equal(li.textContent.replace(/\s+/g, ' ').trim(), `${varName} = ${b.value}`);
      const a = li.querySelector(`a[${M.line}]`);
      assert.ok(a, `binding variable ${varName} must link via a[data-line] to its premise row`);
      assert.equal(a.textContent, varName);
      const targetLine = a.getAttribute(M.line);
      assert.ok(
        rows.some((r) => r.getAttribute(M.line) === targetLine && Number(r.getAttribute(M.depth)) > 0),
        `binding a[data-line="${targetLine}"] must resolve to a premise row`
      );
    }

    // 5. Leaves are base fact sources: published @ source; no leaf is derived. Their origin sign is the reader's to
    // serve: the assertion that a leaf carries one moved, reversed, to tests/red/m1-origin-signs-and-bindings-from-reader
    // (Decision 0014 §5): Cartouche chose it from the kind text "synthetic".
    const leafRows = rows.filter((r) => Number(r.getAttribute(M.depth)) === 1);
    assert.equal(leafRows.length, 3);
    for (const leaf of leafRows) {
      const signs = [...leaf.querySelectorAll(`[${M.sign}]`)].map((s) => s.getAttribute(M.sign));
      assert.equal(signs.includes('derived'), false, 'no leaf row may be derived');
      assert.ok(
        leaf.textContent.includes('@tests/fixtures/slip/README.md#facts/rows.yaml'),
        'leaf row must show published @ source'
      );
    }

    // 6. Seal lists the checker results served by the reader ([data-part="seal"] [data-check])
    const seal = doc.querySelector(`[${M.part}="seal"]`);
    assert.ok(seal, 'expected [data-part="seal"]');
    const checks = new Map(
      [...seal.querySelectorAll(`[${M.check}]`)].map((el) => [el.getAttribute(M.check), el.getAttribute(M.status)])
    );
    // reader-hashes is not served by the reader; its expectation moved to tests/red/m1-seal-checks-only-as-served
    // (Decision 0014 §5).
    assert.equal(checks.get('publisher-record'), 'green');

    // 7. Legend lists every [data-sign] drawn anywhere on the page
    const legend = doc.querySelector(`table[${M.part}="legend"]`);
    assert.ok(legend, 'expected table[data-part="legend"]');
    const listed = new Set([...legend.querySelectorAll(`tr[${M.sign}]`)].map((r) => r.getAttribute(M.sign)));
    const drawn = [...doc.querySelectorAll(`[${M.sign}]`)].filter((el) => !legend.contains(el));
    assert.ok(drawn.length > 0);
    for (const el of drawn) {
      assert.ok(listed.has(el.getAttribute(M.sign)), `legend missing drawn sign "${el.getAttribute(M.sign)}"`);
    }
  } finally {
    await win.happyDOM.close();
  }

  assert.deepEqual(await auditA11y(res.html), []);
});

test('M1 [slip-proof-tree]: depth-2 recorded reader grounds (busy -> group_size -> @ leaves) matches transitive gate premises and rejects digits on unknown', async () => {
  const fx = loadFx10();
  const reader = fx.reader_answers.main.reader;
  const bundle = reader['/slip/bundle?m=m-1'].body;
  const busyAnswer = reader['/slip/m-1/ask/grounds?relation=busy&key=%5B%22group-a%22%5D'].body;

  useMessageFiller(await rezonoMessageFiller());
  const stdPacks = await rezonoStdPacks();
  const catalog = buildSignCatalog(stdPacks, 'en');
  const table = buildAnswerTable(bundle, stdPacks, 'en', 'grounds', 'route', busyAnswer, catalog);
  const answerProp = toAnswerProp(table);

  const { html } = await renderSvelte(PROOF_TREE, { answer: answerProp });
  const { window: win, document: doc } = parseHtml(html);
  try {
    const rows = [...doc.querySelectorAll(`table[${M.answer}="grounds"] tbody tr`)];
    assert.deepEqual(
      rows.map((r) => [r.getAttribute(M.relation), Number(r.getAttribute(M.depth))]),
      [
        ['busy', 0],
        ['group_size', 1],
        ['group', 2],
        ['item__group', 2],
        ['item__group', 2]
      ]
    );

    // Gate-driven transitive check on depth-2 proof
    const renderedSet = new Set(
      rows.map((r) => `${r.getAttribute(M.relation)}\0${r.getAttribute(M.key)}\0${r.getAttribute(M.polarity)}`)
    );
    assert.deepEqual(renderedSet, transitiveGatePremises(busyAnswer));

    // Depth-0 conclusion sentence + bindings link ?g to depth-1 premise group_size
    const link = rows[0].querySelector(`[${M.part}="sentence"] a[${M.line}]`);
    assert.ok(link, 'depth-0 conclusion must link bound variable to depth-1 premise');
    assert.equal(link.textContent, 'group-a');
    assert.equal(link.getAttribute(M.line), '1');

    const bindingLinks = [...rows[0].querySelectorAll(`ul a[${M.line}]`)];
    assert.ok(bindingLinks.some((a) => a.textContent === 'g' && a.getAttribute(M.line) === '1'));

    // Depth-1 intermediate node is derived and links to its depth-2 premise rows
    assert.ok(rows[1].querySelector(`[${M.sign}="derived"]`), 'depth-1 group_size must carry derived sign');
    const depth1Links = [...rows[1].querySelectorAll(`a[${M.line}]`)].map((a) => Number(a.getAttribute(M.line)));
    assert.deepEqual(new Set(depth1Links), new Set([2, 3, 4]), 'depth-1 parent must link to each of its depth-2 premises');

    for (const leaf of rows.slice(2)) {
      const signs = [...leaf.querySelectorAll(`[${M.sign}]`)].map((s) => s.getAttribute(M.sign));
      assert.ok(signs.some((s) => ORIGIN_SIGNS.has(s)), 'depth-2 leaf must carry an origin_* sign');
      assert.equal(signs.includes('derived'), false, 'depth-2 leaf must never be derived');
      assert.ok(leaf.textContent.includes('@tests/fixtures/slip/README.md#facts/rows.yaml'));
    }
  } finally {
    await win.happyDOM.close();
  }

  assert.deepEqual(await auditA11y(html), []);

  // Zero digits on unknown cells in SlipProofTree (rejects any digit leak)
  await assert.rejects(
    () =>
      renderSvelte(PROOF_TREE, {
        answer: {
          question: 'grounds',
          verb: 'why',
          headers: ['Depth', 'Row', 'Value', 'Source'],
          rows: [
            {
              line: 0,
              depth: 0,
              relation: 'check',
              key: '["a"]',
              polarity: 'positive',
              state: 'unknown',
              reason: 'missing_doc',
              proof_ref: 'm-1:check:["a"]',
              cells: [{ text: '0' }, { text: 'check' }, { text: 'unknown 0', sign: 'unknown' }, { text: '' }]
            }
          ]
        }
      }),
    /must not contain digits/
  );
});

test('M1 [slip-proof-tree]: shared DAG deduplicates a premise reached by two paths into one row and links both parents to it', async () => {
  const fx = loadFx10();
  const bundle = fx.reader_answers.main.reader['/slip/bundle?m=m-1'].body;

  // Diamond DAG: conclusion -> branch_a & branch_b -> ONE shared_fact (duplicated in raw nodes as a tree would repeat it)
  const diamondAnswer = {
    question: 'grounds',
    manifest_id: 'm-1',
    start: { relation: 'busy', key: '["group-a"]' },
    nodes: [
      { relation: 'busy', key: '["group-a"]', distance: 0 },
      { relation: 'branch_a', key: '["group-a"]', distance: 1 },
      { relation: 'branch_b', key: '["group-a"]', distance: 1 },
      {
        relation: 'shared_fact',
        key: '["group-a"]',
        distance: 2,
        sources: [{ kind: 'decision', name: 'awir', position: 'art-3' }]
      },
      // Duplicate occurrence of the same shared premise reached via the second path
      {
        relation: 'shared_fact',
        key: '["group-a"]',
        distance: 2,
        sources: [{ kind: 'decision', name: 'awir', position: 'art-3' }]
      }
    ],
    steps: [
      {
        conclusion: { relation: 'busy', key: '["group-a"]' },
        premise: { relation: 'branch_a', key: '["group-a"]' },
        position: 0,
        how: 'positive'
      },
      {
        conclusion: { relation: 'busy', key: '["group-a"]' },
        premise: { relation: 'branch_b', key: '["group-a"]' },
        position: 1,
        how: 'positive'
      },
      {
        conclusion: { relation: 'branch_a', key: '["group-a"]' },
        premise: { relation: 'shared_fact', key: '["group-a"]' },
        position: 0,
        how: 'positive'
      },
      {
        conclusion: { relation: 'branch_b', key: '["group-a"]' },
        premise: { relation: 'shared_fact', key: '["group-a"]' },
        position: 0,
        how: 'positive'
      }
    ],
    witnesses: [
      {
        rule_id: 'busy_group',
        conclusion: { relation: 'busy', key: '["group-a"]' },
        bindings: [{ variable: '?g', value: 'group-a' }]
      },
      {
        rule_id: 'branch_a_rule',
        conclusion: { relation: 'branch_a', key: '["group-a"]' },
        bindings: [{ variable: '?g', value: 'group-a' }]
      },
      {
        rule_id: 'branch_b_rule',
        conclusion: { relation: 'branch_b', key: '["group-a"]' },
        bindings: [{ variable: '?g', value: 'group-a' }]
      }
    ]
  };

  useMessageFiller(await rezonoMessageFiller());
  const stdPacks = await rezonoStdPacks();
  const catalog = buildSignCatalog(stdPacks, 'en');
  const table = buildAnswerTable(bundle, stdPacks, 'en', 'grounds', 'route', diamondAnswer, catalog);
  const { html } = await renderSvelte(PROOF_TREE, { answer: toAnswerProp(table) });
  const { window: win, document: doc } = parseHtml(html);
  try {
    const rows = [...doc.querySelectorAll(`table[${M.answer}="grounds"] tbody tr`)];
    // 4 distinct nodes (busy, branch_a, branch_b, shared_fact) — NOT 5!
    assert.equal(rows.length, 4, 'shared premise reached by two paths must appear as ONE row');
    const sharedRows = rows.filter((r) => r.getAttribute(M.relation) === 'shared_fact');
    assert.equal(sharedRows.length, 1, 'exactly one tr for shared_fact');
    const sharedLine = sharedRows[0].getAttribute(M.line);
    assert.equal(sharedLine, '3');

    // Both parent rows (branch_a and branch_b) link via a[data-line] to that single shared row
    const branchA = rows.find((r) => r.getAttribute(M.relation) === 'branch_a');
    const branchB = rows.find((r) => r.getAttribute(M.relation) === 'branch_b');
    assert.ok(branchA.querySelector(`a[${M.line}="${sharedLine}"]`), 'branch_a must link to the single shared_fact row');
    assert.ok(branchB.querySelector(`a[${M.line}="${sharedLine}"]`), 'branch_b must link to the single shared_fact row');

    // Leaf carries origin_decision sign with glyph and @awir#art-3 citation
    const originSign = sharedRows[0].querySelector(`[${M.sign}="origin_decision"]`);
    assert.ok(originSign, 'decision source must render origin_decision sign');
    assert.ok(originSign.textContent.trim().length > 0);
    assert.ok(sharedRows[0].textContent.includes('@awir#art-3'));
  } finally {
    await win.happyDOM.close();
  }

  assert.deepEqual(await auditA11y(html), []);
});
