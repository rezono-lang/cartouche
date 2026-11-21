// Carried over from rezono-lang/rezono tests/slip/answers-gap.mjs at f15c89d665e2815b02e12665203a9d48dd6abc40.
// A reader that answers one question more than the local reader: `gap`, for an absent row of a derived relation,
// with an empty walk. packages/slip/bin/render.ts loads it as `reader` and wraps the reader's handler with it.
export default function answersGap(handle) {
  return async (request) => {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (request.method === 'GET' && parts.length === 4 && parts[2] === 'ask' && parts[3] === 'gap') {
      const start = { relation: url.searchParams.get('relation'), key: url.searchParams.get('key') };
      return Response.json({
        format: 'rezono.answer/1', question: 'gap', manifest_id: parts[1], start,
        nodes: [{ distance: 0, ...start }], gap: { premises: [], cut: false }
      });
    }
    return handle(request);
  };
}
