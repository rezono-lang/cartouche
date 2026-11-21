import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'Forced colors and reduced motion: under forced-colors: active every colour token maps to a CSS system colour, and every animation or transition in packages sits inside prefers-reduced-motion: no-preference',
  waits_on: []
};

// Decision 0012 §2 (7b). Under Windows High Contrast (forced-colors: active) the browser overrides author colours;
// Cartouche maps each of its colour tokens to a system colour there, as Rezono's forced_colors theme does in
// packs/std-view/palette.yaml, so the signs (glyphs, hatch, dashes) carry the meaning. Motion is opt-in: an
// animation or transition runs only inside @media (prefers-reduced-motion: no-preference).

const ROOT = process.cwd();
const TOKENS = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'std-view.v2.tokens.json'), 'utf8'));
const SYSTEM_COLOURS = new Set(
  [
    'AccentColor', 'AccentColorText', 'ActiveText', 'ButtonBorder', 'ButtonFace', 'ButtonText', 'Canvas', 'CanvasText',
    'Field', 'FieldText', 'GrayText', 'Highlight', 'HighlightText', 'LinkText', 'Mark', 'MarkText', 'SelectedItem',
    'SelectedItemText', 'VisitedText'
  ].map((c) => c.toLowerCase())
);

function sources(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sources(full));
    else if (/\.(svelte|css|ts)$/.test(entry.name)) out.push(full);
  }
  return out;
}
const FILES = sources(path.join(ROOT, 'packages')).map((f) => ({ rel: path.relative(ROOT, f), text: fs.readFileSync(f, 'utf8') }));

// The body of every @media block whose query matches, by brace matching.
function mediaBlocks(text, query) {
  const blocks = [];
  const re = new RegExp(`@media[^{]*${query}[^{]*\\{`, 'g');
  for (let m = re.exec(text); m; m = re.exec(text)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < text.length && depth > 0) {
      if (text[i] === '{') depth++;
      if (text[i] === '}') depth--;
      i++;
    }
    blocks.push({ start: m.index, end: i, body: text.slice(start, i - 1) });
  }
  return blocks;
}

test('M1 [forced-colors-reduced-motion]: under forced-colors: active every colour token maps to a system colour', () => {
  const mapped = new Map();
  for (const { text } of FILES) {
    for (const block of mediaBlocks(text, 'forced-colors\\s*:\\s*active')) {
      for (const d of block.body.matchAll(/(--c-[a-z-]+)\s*:\s*([A-Za-z]+)\s*[;}]/g)) mapped.set(d[1], d[2].toLowerCase());
    }
  }
  const missing = Object.values(TOKENS.css_vars).filter((v) => !SYSTEM_COLOURS.has(mapped.get(v) ?? ''));
  assert.deepEqual(missing, [], 'colour tokens without a system colour under @media (forced-colors: active)');
});

test('M1 [forced-colors-reduced-motion]: every animation and transition in packages is opt-in under prefers-reduced-motion: no-preference', () => {
  const ungated = [];
  for (const { rel, text } of FILES) {
    const allowed = mediaBlocks(text, 'prefers-reduced-motion\\s*:\\s*no-preference');
    for (const m of text.matchAll(/(?<![\w-])(animation|transition)(-[a-z-]+)?\s*:/g)) {
      if (!allowed.some((b) => m.index > b.start && m.index < b.end)) ungated.push(`${rel}: ${m[0]}`);
    }
    for (const m of text.matchAll(/<animate(Transform|Motion)?\b/g)) ungated.push(`${rel}: SMIL ${m[0]} (use CSS behind the media query)`);
  }
  assert.deepEqual(ungated, [], 'motion that ignores prefers-reduced-motion');
});
