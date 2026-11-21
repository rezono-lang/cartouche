import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'Every mark on every sheet is a link to the slip opened on its conclusion address (Rezono conclusion IRI pinned to epoch and dataset hash); every target resolves in the slip to exactly that row, and a pin that does not match is refused',
  waits_on: [
    'm1-sheet-reads-gate-output'
  ]
};

// Decision 0012 §2 (1). No sheet opens the slip from a mark today. The address is the one Rezono defines in
// decisions/publication-conclusion-addresses.md: <kind iri>/<spelled id>?pin=m-<epoch>@d-<64 hex> for a conclusion, and
// <base>witness/<64 hex> for a witness. Cartouche reads the address from the reader; it never builds one from parts.

test('M1 [mark-opens-slip]: every mark links to the slip at its pinned conclusion address and the slip resolves it', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. Scope: every sheet that renders from recorded gate output (see m1-sheet-reads-gate-output), the slip itself (each tr[data-line] links to its own address, so a reader can walk the proof), and each further sheet as it moves to gate output. A parked sheet that still reads a hand-written fixture draws no link it cannot honour.',
      '2. Every element that carries data-proof-ref is an a[href] or sits inside or contains exactly one a[href]. The href opens the slip with the pinned conclusion IRI as the query parameter at (encodeURIComponent of the IRI); the page path is up to the implementation.',
      '3. The at value matches ^[a-z][a-z0-9+.-]*://[^?#\\s]+\\?pin=m-[0-9]+@d-[0-9a-f]{64}$. Marks of one conclusion share one address; marks of different conclusions (different data-key) have different addresses.',
      '4. Resolution: packages/slip/bin/render.ts accepts at. render({ ...source, at }) serves a page (no [data-part=unserved]) whose home line tr[data-line] has the data-relation and data-key of the conclusion the IRI names, and whose seal names the same epoch and dataset hash as the pin.',
      '5. A pin whose dataset hash does not match the publication is refused: [data-part=unserved] and zero tr[data-line]. An address of a withdrawn epoch or row gives the 410 page. A mark is never answered with another row.',
      '6. Where the reader does not serve conclusion IRIs, open the issue in rezono-lang/rezono and keep this test red; Cartouche does not spell IRIs itself.'
    ].join('\n')
  );
});
