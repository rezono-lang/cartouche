import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VIEWER_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(VIEWER_DIR, '..', '..');

export default defineConfig({
  root: VIEWER_DIR,
  plugins: [svelte()],
  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json', '.svelte']
  },
  server: {
    fs: {
      allow: [REPO_ROOT]
    }
  },
  build: {
    outDir: path.join(VIEWER_DIR, 'dist'),
    emptyOutDir: true
  }
});
