import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { auditA11y } from '../../scripts/svelte-test-harness.mjs';

// Decision 0012 §2 (7a). Every ink and sign token in contracts/std-view.v2.tokens.json reaches WCAG AA 4.5:1 on
// paper, paperElev and paperTint in every palette, and auditA11y genuinely decides colour contrast on rendered DOM
// (a 3.03:1 text is reported as a color-contrast violation, never silently passed as incomplete).

const ROOT = process.cwd();
const TOKENS = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'std-view.v2.tokens.json'), 'utf8'));
const INKS = ['ink', 'inkSoft', 'inkFaint', 'proof', 'valid', 'caution', 'violated', 'hatchStroke'];
const SURFACES = ['paper', 'paperElev', 'paperTint'];
const AA = 4.5;

function linearRgb(color) {
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return [0, 2, 4].map((i) => {
      const c = parseInt(hex[1].slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  }
  const m = color.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  assert.ok(m, `token ${color} is oklch(L C h) or #rrggbb`);
  const [L, C, h] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s
  ].map((v) => Math.min(1, Math.max(0, v)));
}
const luminance = (color) => {
  const [r, g, b] = linearRgb(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (fg, bg) => {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('M1 [contrast-wcag-aa]: every ink and sign token reaches 4.5:1 on every paper surface of every palette', () => {
  const below = [];
  for (const [name, palette] of Object.entries(TOKENS.palettes)) {
    for (const surface of SURFACES) {
      for (const ink of INKS) {
        const r = ratio(palette.tokens[ink], palette.tokens[surface]);
        if (r < AA) below.push(`${name} ${ink} on ${surface}: ${r.toFixed(2)}:1`);
      }
    }
  }
  assert.deepEqual(below, [], `tokens below WCAG AA ${AA}:1 in contracts/std-view.v2.tokens.json`);
});

const LOW = '<p style="color:#949494;background-color:#ffffff">Low contrast text</p>';
const HIGH = '<p style="color:#1c1b19;background-color:#faf8f3">Readable text</p>';

async function contrastVerdict(fragment) {
  try {
    const violations = await auditA11y(fragment);
    return violations.some((v) => v.id === 'color-contrast') ? 'violation' : 'pass';
  } catch (error) {
    return /color-contrast/.test(String(error?.message)) ? 'violation' : `error: ${error?.message}`;
  }
}

test('M1 [contrast-wcag-aa]: auditA11y checks colour contrast and does not pass what it cannot decide', async () => {
  assert.equal(await contrastVerdict(LOW), 'violation', 'auditA11y reports #949494 on white (3.03:1) as a color-contrast violation');
  assert.equal(await contrastVerdict(HIGH), 'pass', 'auditA11y passes ink on paper (17.9:1) without a color-contrast violation');
});

test('M1 [contrast-wcag-aa]: auditA11y decides CSS <style> rules, OKLCH/var(--c-*) tokens, and flags unparseable foregrounds', async () => {
  const lowStyle = '<style>.muted { color: oklch(0.75 0.01 80); background: var(--c-paper); }</style><p class="muted">Too faint</p>';
  const highStyle = '<style>.ok { color: var(--c-ink-faint); background: var(--c-paper-tint); }</style><p class="ok">Accessible token</p>';
  const unknownFg = '<p style="color: not-a-color-fn(1,2); background-color: #ffffff">Undecidable</p>';

  assert.equal(await contrastVerdict(lowStyle), 'violation', 'low-contrast OKLCH in <style> must be flagged');
  assert.equal(await contrastVerdict(highStyle), 'pass', 'frozen swisstopo inkFaint on paperTint passes 4.95:1');
  assert.equal(await contrastVerdict(unknownFg), 'violation', 'undecidable color must not silently pass');
});
