import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ReaderClient, payloadHash, HASH_HEADER } from '../../packages/reader-core/src/client.ts';

const fx = (n) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'fixtures', n), 'utf8'));

test('ReaderClient: handler transport, endpoints, status mapping, SHA-256 verification', async () => {
  const unserved = fx('07-unserved-410.json');
  const conf = fx('09-slip-conformance.json');
  const seen = [];
  const handler = async (req) => {
    seen.push(`${req.method} ${req.path} ${req.role ?? ''}`);
    if (req.path === '/head') return { status: 200, body: { id: conf.manifest.id } };
    if (req.path === '/bundle') {
      return { status: 200, headers: { [HASH_HEADER]: await payloadHash(conf) }, body: conf };
    }
    if (req.path === '/ask/grounds') return { status: 200, body: { rows: [] } };
    if (req.path === '/ask/reach') return { status: 404 };
    if (req.path === '/ask/sweep') return { status: 501 };
    if (req.path === '/ask/scenario') return { status: unserved.http_status, body: { unserved: unserved.unserved } };
    return { status: 500 };
  };
  const c = new ReaderClient({ handler, role: 'reader' });

  assert.equal((await c.head()).body.id, conf.manifest.id);
  const b = await c.bundle();
  assert.equal(b.kind, 'ok');
  assert.equal(b.verified, true);
  assert.deepEqual(b.body, conf);
  assert.equal((await c.grounds({})).kind, 'ok');
  assert.deepEqual(await c.reach({}), { kind: 'unanswered', status: 404 });
  assert.deepEqual(await c.sweep({}), { kind: 'unanswered', status: 501 });
  const u = await c.scenario({});
  assert.equal(u.kind, 'unserved');
  assert.deepEqual(u.unserved, unserved.unserved);
  assert.ok(seen.includes('GET /bundle reader'));
});

test('ReaderClient: tampered payload fails SHA-256; fetch transport works and is deterministic', async () => {
  const conf = fx('09-slip-conformance.json');
  const bad = new ReaderClient({ handler: () => ({ status: 200, headers: { [HASH_HEADER]: 'sha256:00' }, body: conf }) });
  assert.deepEqual(await bad.bundle(), { kind: 'error', status: 200, reason: 'sha256_mismatch' });

  const calls = [];
  const f = async (url, init) => {
    calls.push([url, init.method, init.headers['x-rezono-role']]);
    return { status: 200, headers: { get: () => null }, text: async () => JSON.stringify(conf) };
  };
  const c = new ReaderClient({ fetch: f, baseUrl: 'http://x', role: 'reader' });
  const a = await c.bundle();
  const a2 = await c.bundle();
  assert.equal(a.sha256, a2.sha256);
  assert.equal(a.sha256, await payloadHash(conf));
  assert.deepEqual(calls[0], ['http://x/bundle', 'GET', 'reader']);
  const junk = new ReaderClient({ fetch: async () => ({ status: 200, headers: { get: () => null }, text: async () => 'not json' }) });
  assert.deepEqual(await junk.head(), { kind: 'error', status: 200, reason: 'invalid_json' });
  assert.throws(() => new ReaderClient({}));
});
