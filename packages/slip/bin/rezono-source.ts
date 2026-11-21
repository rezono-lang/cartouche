/**
 * Rezono sources consumed by @rezono/slip at build time (Decision 0009, point 2).
 *
 * Reads each file named in ../rezono-source.json at the pinned Rezono commit and refuses any other bytes.
 * Files are cached under node_modules/.cache/rezono-source/<commit>/ (outside git); a missing file is fetched
 * from raw.githubusercontent.com at that commit. Nothing from Rezono is copied into the repository.
 * The message filler is imported from the verified cache file and used as Rezono ships it.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';
import type { MessageFiller, StdPacks } from '../src/types.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SLIP_DIR = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(SLIP_DIR, '..', '..');

interface RezonoSourcePin {
  readonly repository: string;
  readonly commit: string;
  readonly files: Readonly<Record<string, string>>;
}

export const REZONO_SOURCE: RezonoSourcePin = JSON.parse(
  fs.readFileSync(path.join(SLIP_DIR, 'rezono-source.json'), 'utf8')
) as RezonoSourcePin;

const CACHE_DIR = path.join(REPO_ROOT, 'node_modules', '.cache', 'rezono-source', REZONO_SOURCE.commit);

function sha256(bytes: Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

async function fetchPinned(rel: string): Promise<Uint8Array> {
  const url = `https://raw.githubusercontent.com/${REZONO_SOURCE.repository}/${REZONO_SOURCE.commit}/${rel}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`rezono-source: ${url} answered ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** The verified local path of one pinned Rezono file. */
export async function rezonoFile(rel: string): Promise<string> {
  const expected = REZONO_SOURCE.files[rel];
  if (expected === undefined) throw new Error(`rezono-source: ${rel} is not pinned in rezono-source.json`);
  const target = path.join(CACHE_DIR, ...rel.split('/'));
  if (fs.existsSync(target) && sha256(fs.readFileSync(target)) === expected) return target;
  const bytes = await fetchPinned(rel);
  const got = sha256(bytes);
  if (got !== expected) {
    throw new Error(`rezono-source: ${rel} at ${REZONO_SOURCE.commit} hashes to ${got}, pinned ${expected}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  return target;
}

async function readText(rel: string): Promise<string> {
  return fs.readFileSync(await rezonoFile(rel), 'utf8').replace(/\r\n?/g, '\n');
}

let packsOnce: Promise<StdPacks> | undefined;
let fillerOnce: Promise<MessageFiller> | undefined;

/** Rezono's std-view verbs, signs, statuses and messages and std-explain messages, as its slip build read them. */
export function rezonoStdPacks(): Promise<StdPacks> {
  packsOnce ??= (async () => {
    const sheets = parseYaml(await readText('packs/std-view/sheets.yaml')) as { verbs?: StdPacks['verbs'] };
    const key = parseYaml(await readText('packs/std-view/key.yaml')) as {
      signs?: StdPacks['signs'];
      statuses?: StdPacks['statuses'];
    };
    const langs = ['en', 'nl'];
    return {
      viewMessages: await Promise.all(
        langs.map(async (lang) => ({ lang, resource: await readText(`packs/std-view/messages/${lang}.mf2`) }))
      ),
      explainMessages: await Promise.all(
        langs.map(async (lang) => ({ lang, resource: await readText(`packs/std-explain/messages/${lang}.mf2`) }))
      ),
      verbs: sheets.verbs ?? [],
      signs: key.signs ?? [],
      statuses: key.statuses ?? []
    };
  })();
  return packsOnce;
}

/** Rezono's MF2 message filler (viewer/messages/src/fill.ts), imported from the verified pinned file. */
export function rezonoMessageFiller(): Promise<MessageFiller> {
  fillerOnce ??= (async () => {
    // Node strips no types under node_modules, so the verified source is stripped here, as Rezono's own slip build
    // does (node:module stripTypeScriptTypes), into a module beside it named after the pinned hash.
    const rel = 'viewer/messages/src/fill.ts';
    const file = await rezonoFile(rel);
    const stripped = path.join(path.dirname(file), `fill.${REZONO_SOURCE.files[rel]}.mjs`);
    if (!fs.existsSync(stripped)) {
      const source = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
      fs.writeFileSync(stripped, stripTypeScriptTypes(source, { mode: 'strip' }));
    }
    const mod = (await import(pathToFileURL(stripped).href)) as MessageFiller;
    if (typeof mod.fill !== 'function' || typeof mod.fillParts !== 'function') {
      throw new Error('rezono-source: viewer/messages/src/fill.ts exports no fill/fillParts');
    }
    return { fill: mod.fill, fillParts: mod.fillParts };
  })();
  return fillerOnce;
}
