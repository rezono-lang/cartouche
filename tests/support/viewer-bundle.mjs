/**
 * The modules the browser gets: the viewer's production build (Vite, write: false), as repo-relative paths.
 * Decision 0014: what runs in the page is read from the build graph, not from source text.
 */

import path from 'node:path';
import { build } from 'vite';

const ROOT = process.cwd();

export async function viewerBundleModules() {
  const out = await build({
    configFile: path.join(ROOT, 'apps', 'atlas-viewer', 'vite.config.ts'),
    logLevel: 'silent',
    build: { write: false }
  });
  const outputs = (Array.isArray(out) ? out : [out]).flatMap((o) => o.output);
  const ids = new Set();
  for (const chunk of outputs) {
    if (chunk.type !== 'chunk') continue;
    for (const id of chunk.moduleIds ?? Object.keys(chunk.modules ?? {})) {
      const file = id.split('?')[0].replace(/^\0/, '');
      if (!path.isAbsolute(file)) continue;
      ids.add(path.relative(ROOT, file).split(path.sep).join('/'));
    }
  }
  return [...ids].filter((rel) => !rel.startsWith('node_modules/') && !rel.startsWith('..')).sort();
}
