/**
 * Domain-neutral Rezono ReaderClient. Transport is either `fetch` or an
 * injected in-process handler. Payloads are opaque; nothing is interpreted.
 */
import { canonicalJson } from './canon.ts';

export type ReaderAskKind = 'grounds' | 'reach' | 'sweep' | 'scenario';

export interface ReaderTransportResponse {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface ReaderRequest {
  method: 'GET' | 'POST';
  path: string;
  role?: string | undefined;
  body?: unknown;
}

export type ReaderHandler = (req: ReaderRequest) => Promise<ReaderTransportResponse> | ReaderTransportResponse;

export interface ReaderClientOptions {
  baseUrl?: string;
  fetch?: (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{
    status: number;
    headers: { get(name: string): string | null };
    text(): Promise<string>;
  }>;
  handler?: ReaderHandler;
  role?: string;
}

export type ReaderResult<T = unknown> =
  | { kind: 'ok'; status: number; body: T; verified: boolean; sha256: string }
  | { kind: 'unanswered'; status: number }
  | { kind: 'unserved'; status: 410; unserved: unknown }
  | { kind: 'error'; status: number; reason: string };

export const HASH_HEADER = 'x-content-sha256';

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
  let out = '';
  for (const b of digest) out += b.toString(16).padStart(2, '0');
  return out;
}

export async function payloadHash(body: unknown): Promise<string> {
  return `sha256:${await sha256Hex(canonicalJson(body))}`;
}

export class ReaderClient {
  private readonly opts: ReaderClientOptions;

  constructor(opts: ReaderClientOptions) {
    if (!opts.handler && !opts.fetch) throw new Error('ReaderClient needs a fetch or handler transport');
    this.opts = opts;
  }

  head(): Promise<ReaderResult> {
    return this.call({ method: 'GET', path: '/head' });
  }

  bundle(role?: string): Promise<ReaderResult> {
    return this.call({ method: 'GET', path: '/bundle', role });
  }

  ask(kind: ReaderAskKind, question: unknown): Promise<ReaderResult> {
    return this.call({ method: 'POST', path: `/ask/${kind}`, body: question });
  }

  grounds(q: unknown) { return this.ask('grounds', q); }
  reach(q: unknown) { return this.ask('reach', q); }
  sweep(q: unknown) { return this.ask('sweep', q); }
  scenario(q: unknown) { return this.ask('scenario', q); }

  private async transport(req: ReaderRequest): Promise<ReaderTransportResponse> {
    const { handler, fetch: f, baseUrl = '' } = this.opts;
    if (handler) return handler(req);
    const headers: Record<string, string> = { accept: 'application/json' };
    if (req.role) headers['x-rezono-role'] = req.role;
    const init: { method: string; headers: Record<string, string>; body?: string } = { method: req.method, headers };
    if (req.body !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = canonicalJson(req.body);
    }
    const res = await f!(`${baseUrl}${req.path}`, init);
    const text = await res.text();
    let body: unknown;
    if (text.length > 0) {
      try { body = JSON.parse(text); } catch { body = undefined; }
    }
    const h = res.headers.get(HASH_HEADER);
    return { status: res.status, headers: h === null ? {} : { [HASH_HEADER]: h }, body };
  }

  private async call(req: ReaderRequest): Promise<ReaderResult> {
    const full: ReaderRequest = { ...req, role: req.role ?? this.opts.role };
    const res = await this.transport(full);
    const s = res.status;
    if (s === 404 || s === 501) return { kind: 'unanswered', status: s };
    if (s === 410) return { kind: 'unserved', status: 410, unserved: (res.body as { unserved?: unknown } | undefined)?.unserved ?? res.body ?? null };
    if (s < 200 || s >= 300) return { kind: 'error', status: s, reason: 'http_status' };
    const sha256 = await payloadHash(res.body);
    const expected = res.headers?.[HASH_HEADER];
    if (expected !== undefined && expected !== sha256) {
      return { kind: 'error', status: s, reason: 'sha256_mismatch' };
    }
    return { kind: 'ok', status: s, body: res.body, verified: expected !== undefined, sha256 };
  }
}

