import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { paletteCss } from '../../packages/reader-core/src/palette.ts';

// Decision 0012 §7. Fonts are assets, not code; OFL-1.1 is allowed for self-hosted font files with their licence next
// to them. Rezono's packs/std-view/key.yaml names system-ui and ui-monospace today: propose the pair there too, so the
// key stays one.

const ROOT = process.cwd();
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'coverage']);

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

test('M2 [typeface-plex-self-hosted] 1: self-hosted sans and mono woff2 files exist with OFL licence beside them and NOTICE entry', () => {
  const woff2Files = walkFiles(ROOT).filter((f) => f.toLowerCase().endsWith('.woff2'));
  assert.ok(
    woff2Files.length >= 2,
    `Expected at least 2 self-hosted .woff2 font files (sans + mono) in the repository, found ${woff2Files.length}.`
  );

  const relNames = woff2Files.map((f) => path.relative(ROOT, f).replace(/\\/g, '/'));
  const hasSans = relNames.some((f) => /sans/i.test(path.basename(f)));
  const hasMono = relNames.some((f) => /mono/i.test(path.basename(f)));
  assert.ok(hasSans, `Expected at least one self-hosted sans .woff2 file, found: ${relNames.join(', ')}`);
  assert.ok(hasMono, `Expected at least one self-hosted mono .woff2 file, found: ${relNames.join(', ')}`);

  for (const f of woff2Files) {
    assert.ok(fs.statSync(f).size > 0, `Self-hosted font file must be non-empty: ${path.relative(ROOT, f)}`);
    const dir = path.dirname(f);
    const parent = path.dirname(dir);
    const licenceCandidates = [
      path.join(dir, 'OFL.txt'),
      path.join(dir, 'OFL-1.1.txt'),
      path.join(dir, 'LICENSE.txt'),
      path.join(dir, 'LICENSE'),
      path.join(parent, 'OFL.txt'),
      path.join(parent, 'OFL-1.1.txt')
    ];
    const foundLicence = licenceCandidates.find((c) => fs.existsSync(c));
    assert.ok(
      foundLicence,
      `Expected OFL.txt (or font licence text) beside ${path.relative(ROOT, f)}.`
    );
    const licText = fs.readFileSync(foundLicence, 'utf8');
    assert.match(
      licText,
      /SIL Open Font License|OFL/i,
      `Font licence file ${path.relative(ROOT, foundLicence)} must contain the OFL licence text.`
    );
  }

  const notice = fs.readFileSync(path.join(ROOT, 'NOTICE'), 'utf8');
  assert.match(
    notice,
    /OFL-1\.1|SIL Open Font License/i,
    'Root NOTICE must record the self-hosted font pair and its OFL-1.1 licence.'
  );
});

test('M2 [typeface-plex-self-hosted] 2: @font-face uses relative url() per woff2 and zero third-party font hosts exist', () => {
  const sourceFiles = [
    ...walkFiles(path.join(ROOT, 'packages')),
    ...walkFiles(path.join(ROOT, 'apps')),
    ...walkFiles(path.join(ROOT, 'docs'))
  ].filter((f) => /\.(css|svelte|ts|js|mjs|html)$/i.test(f));

  const thirdPartyFontHostRe = /https?:\/\/(?:fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|rsms\.me)/i;
  for (const f of sourceFiles) {
    const content = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(
      content,
      thirdPartyFontHostRe,
      `Third-party font host URL is forbidden in ${path.relative(ROOT, f)}.`
    );
  }

  const fontFaceBlocks = [];
  for (const f of sourceFiles) {
    const content = fs.readFileSync(f, 'utf8');
    for (const m of content.matchAll(/@font-face\s*\{([^}]*)\}/gs)) {
      fontFaceBlocks.push({ file: f, body: m[1] });
    }
  }

  const woff2Files = walkFiles(ROOT).filter((f) => f.toLowerCase().endsWith('.woff2'));
  assert.ok(
    fontFaceBlocks.length >= Math.max(2, woff2Files.length),
    `Expected at least one @font-face rule per self-hosted .woff2 file (found ${fontFaceBlocks.length} @font-face rules for ${woff2Files.length} .woff2 files).`
  );

  for (const block of fontFaceBlocks) {
    const urlMatch = block.body.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
    assert.ok(urlMatch, `@font-face in ${path.relative(ROOT, block.file)} must declare a url().`);
    const ref = urlMatch[1];
    assert.doesNotMatch(
      ref,
      /^https?:\/\//i,
      `@font-face url(${ref}) in ${path.relative(ROOT, block.file)} must be relative, not remote.`
    );
    assert.match(ref, /\.woff2(?:[?#].*)?$/i, `@font-face url(${ref}) must point to a .woff2 asset.`);
  }
});

test('M2 [typeface-plex-self-hosted] 3: std-view tokens define sans and mono variables used by every sheet, the slip, and the specimen', () => {
  const css = paletteCss('swisstopo');
  assert.match(
    css,
    /--(?:c-)?font-sans\s*:\s*[^;]+;/i,
    'paletteCss("swisstopo") must define a std-view sans font variable (--font-sans or --c-font-sans).'
  );
  assert.match(
    css,
    /--(?:c-)?font-mono\s*:\s*[^;]+;/i,
    'paletteCss("swisstopo") must define a std-view mono font variable (--font-mono or --c-font-mono).'
  );

  const sansDecl = css.match(/--(?:c-)?font-sans\s*:\s*([^;]+);/i)?.[1] ?? '';
  const monoDecl = css.match(/--(?:c-)?font-mono\s*:\s*([^;]+);/i)?.[1] ?? '';
  assert.doesNotMatch(
    sansDecl.trim(),
    /^system-ui\b/i,
    `Sans font variable must lead with the self-hosted sans family, not bare system-ui: "${sansDecl}".`
  );
  assert.doesNotMatch(
    monoDecl.trim(),
    /^ui-monospace\b/i,
    `Mono font variable must lead with the self-hosted mono family, not bare ui-monospace: "${monoDecl}".`
  );

  const sheetFiles = fs
    .readdirSync(path.join(ROOT, 'packages', 'atlas', 'src'))
    .filter((f) => f.endsWith('Sheet.svelte'))
    .map((f) => path.join(ROOT, 'packages', 'atlas', 'src', f));
  const targets = [
    ...sheetFiles,
    path.join(ROOT, 'packages', 'slip', 'src', 'Slip.svelte'),
    path.join(ROOT, 'packages', 'atlas', 'src', 'specimen.ts')
  ];

  for (const file of targets) {
    const content = fs.readFileSync(file, 'utf8');
    assert.match(
      content,
      /var\(\s*--(?:c-)?font-(?:sans|mono)/i,
      `${path.relative(ROOT, file)} must consume the std-view font CSS variables (--font-sans / --font-mono).`
    );
  }

  const slipValueSrc = fs.readFileSync(path.join(ROOT, 'packages', 'slip', 'src', 'SlipValueCell.svelte'), 'utf8');
  const slipSrc = fs.readFileSync(path.join(ROOT, 'packages', 'slip', 'src', 'Slip.svelte'), 'utf8');
  assert.match(
    `${slipSrc}\n${slipValueSrc}`,
    /var\(\s*--(?:c-)?font-mono/i,
    'Slip values/hashes/keys must render with the std-view mono font variable.'
  );
});

test('M2 [typeface-plex-self-hosted] 4: licence guard allows OFL-1.1 for font files only and forbids it for runtime code', () => {
  const pin = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'rezono-pin.json'), 'utf8'));
  assert.ok(
    !pin.allowed_runtime_licences.includes('OFL-1.1'),
    'contracts/rezono-pin.json allowed_runtime_licences must NOT permit OFL-1.1 for runtime code.'
  );

  const licenseCheck = fs.readFileSync(path.join(ROOT, 'scripts', 'license-check.mjs'), 'utf8');
  const fontCheckPath = path.join(ROOT, 'scripts', 'font-license-check.mjs');
  const combined = licenseCheck + (fs.existsSync(fontCheckPath) ? `\n${fs.readFileSync(fontCheckPath, 'utf8')}` : '');
  assert.match(
    combined,
    /OFL-1\.1|OFL\.txt/i,
    'scripts/license-check.mjs (or sibling scripts/font-license-check.mjs) must explicitly verify OFL-1.1 for font assets.'
  );
  assert.match(
    combined,
    /\.woff2/i,
    'Font licence guard must scope OFL-1.1 permission specifically to font files (.woff2).'
  );
});
