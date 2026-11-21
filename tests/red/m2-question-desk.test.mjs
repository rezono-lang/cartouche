import test from 'node:test';
import assert from 'node:assert/strict';
import * as atlas from '../../packages/atlas/src/index.ts';
import { asOpaqueCell } from '../../packages/reader-core/src/opaque.ts';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  summary:
    'Question desk as the entry page: start from the declared Rezono questions, or for a citizen from their own case; an optional LLM front answers only through declared questions, always shows the question, its parameters and its witness, else says unknown because',
  waits_on: [
    'm1-absent-never-valid-colour',
    'm1-claims-match-build',
    'm1-contrast-wcag-aa',
    'm1-forced-colors-reduced-motion',
    'm1-green-guard-covers-harness',
    'm1-invalid-drawn-everywhere',
    'm1-mark-opens-slip',
    'm1-monge-unknown-and-state-colours',
    'm1-motion-between-epochs',
    'm1-no-borrowed-proof-refs',
    'm1-proof-refs-only-as-served',
    'm1-propose-locked-until-served',
    'm1-reads-only-served-head-fields',
    'm1-sheet-reads-gate-output',
    'm1-slip-all-witnesses',
    'm1-slip-proof-tree',
    'm1-slip-why-not-why-unknown',
    'm1-time-valid-at-known-at',
    'm1-viewer-prerendered-and-guarded',
    'm1-zero-compute-lint-fails-closed'
  ]
};

// Decision 0012 §3 (8). There is no app or entry page today. After Stardog Voicebox answer provenance, done stricter:
// every answer is a Rezono row with its proof.

const CATALOGUE_FIXTURE = Object.freeze({
  questions: Object.freeze([
    Object.freeze({
      id: 'grounds_by_subject',
      roles: ['checker', 'citizen'],
      params: ['subject'],
      labelKey: 'question.grounds_by_subject'
    }),
    Object.freeze({
      id: 'audit_summary',
      roles: ['checker'],
      params: ['epoch'],
      labelKey: 'question.audit_summary'
    })
  ]),
  messages: Object.freeze({
    en: Object.freeze({
      'question.grounds_by_subject': 'Why does this outcome hold for a subject?',
      'question.audit_summary': 'Audit summary for an epoch',
      'desk.unknown_because': 'Unknown, because {$reason}'
    }),
    nl: Object.freeze({
      'question.grounds_by_subject': 'Waarom geldt deze uitkomst voor een onderwerp?',
      'question.audit_summary': 'Controleoverzicht voor een tijdvak',
      'desk.unknown_because': 'Onbekend, omdat {$reason}'
    })
  })
});

const READER_ANSWERS = Object.freeze({
  grounds_by_subject: Object.freeze({
    'subject-a': Object.freeze({
      status: 'known',
      rows: Object.freeze([
        Object.freeze({
          key: 'subject-a',
          display: asOpaqueCell({ display: '136.00_OPAQUE', state: 'known', proof_ref: 'witness:subject-a:m-4' }),
          proofRef: 'witness:subject-a:m-4',
          slipHref: '#slip/calc__outcome/subject-a?pin=m-4@d-0000'
        })
      ])
    }),
    'subject-b': Object.freeze({
      status: 'known',
      rows: Object.freeze([
        Object.freeze({
          key: 'subject-b',
          display: asOpaqueCell({ display: '99.00_OPAQUE', state: 'known', proof_ref: 'witness:subject-b:m-4' }),
          proofRef: 'witness:subject-b:m-4',
          slipHref: '#slip/calc__outcome/subject-b?pin=m-4@d-0000'
        })
      ])
    }),
    'subject-gap': Object.freeze({
      status: 'unknown',
      reason: 'premise_missing',
      rows: Object.freeze([])
    })
  })
});

test('M2 [question-desk] 1: entry page lists declared questions the role may ask with MF2 labels in Dutch and English', () => {
  assert.equal(
    typeof atlas.renderQuestionDesk,
    'function',
    'packages/atlas/src/index.ts must export renderQuestionDesk(input) for the M2 question desk.'
  );

  const enHtml = atlas.renderQuestionDesk({
    catalogue: CATALOGUE_FIXTURE,
    role: 'checker',
    locale: 'en'
  });
  assert.ok(
    enHtml.includes('Why does this outcome hold for a subject?'),
    'English entry page must render MF2 label for grounds_by_subject.'
  );
  assert.ok(
    enHtml.includes('Audit summary for an epoch'),
    'English entry page must render MF2 label for audit_summary.'
  );

  const nlHtml = atlas.renderQuestionDesk({
    catalogue: CATALOGUE_FIXTURE,
    role: 'checker',
    locale: 'nl'
  });
  assert.ok(
    nlHtml.includes('Waarom geldt deze uitkomst voor een onderwerp?'),
    'Dutch entry page must render Dutch MF2 label for grounds_by_subject.'
  );
  assert.ok(
    nlHtml.includes('Controleoverzicht voor een tijdvak'),
    'Dutch entry page must render Dutch MF2 label for audit_summary.'
  );

  const citizenHtml = atlas.renderQuestionDesk({
    catalogue: CATALOGUE_FIXTURE,
    role: 'citizen',
    subjectKey: 'subject-a',
    locale: 'en',
    answers: READER_ANSWERS
  });
  assert.ok(
    !citizenHtml.includes('Audit summary for an epoch') && !citizenHtml.includes('audit_summary'),
    'Role-scoped entry page must not list questions the citizen role may not ask.'
  );
});

test('M2 [question-desk] 2: citizen role opens on their own case with zero leakage of other keys', () => {
  assert.equal(
    typeof atlas.renderQuestionDesk,
    'function',
    'packages/atlas/src/index.ts must export renderQuestionDesk(input).'
  );

  const citizenHtml = atlas.renderQuestionDesk({
    catalogue: CATALOGUE_FIXTURE,
    role: 'citizen',
    subjectKey: 'subject-a',
    locale: 'en',
    answers: READER_ANSWERS
  });

  assert.ok(citizenHtml.includes('136.00_OPAQUE'), 'Citizen entry view must display their own conclusion.');
  assert.ok(
    !citizenHtml.includes('subject-b') && !citizenHtml.includes('99.00_OPAQUE'),
    'Citizen entry view must leak zero keys or values belonging to other subjects.'
  );
});

test('M2 [question-desk] 3: asking a question renders answer rows with question term, parameters, and per-row slip links', () => {
  assert.equal(
    typeof atlas.renderQuestionDesk,
    'function',
    'packages/atlas/src/index.ts must export renderQuestionDesk(input).'
  );

  const html = atlas.renderQuestionDesk({
    catalogue: CATALOGUE_FIXTURE,
    role: 'checker',
    locale: 'en',
    activeQuery: { question: 'grounds_by_subject', params: { subject: 'subject-a' } },
    answers: READER_ANSWERS
  });

  assert.match(html, /<table\b[^>]*data-answer="grounds_by_subject"/, 'Answer must render inside table[data-answer].');
  assert.match(html, /<th\b/i, 'Answer table must include <th> headers.');
  assert.ok(html.includes('subject-a'), 'Answer view must display the question parameters.');
  assert.ok(html.includes('136.00_OPAQUE'), 'Answer view must display the opaque Rezono row value.');
  assert.match(
    html,
    /<a\b[^>]*href="#slip\/calc__outcome\/subject-a\?pin=m-4@d-0000"[^>]*data-proof-ref="witness:subject-a:m-4"|<a\b[^>]*data-proof-ref="witness:subject-a:m-4"[^>]*href="#slip\/calc__outcome\/subject-a\?pin=m-4@d-0000"/,
    'Every answer row must link to its slip with href and data-proof-ref.'
  );
});

test('M2 [question-desk] 4 & 5: optional LLM front may only pick a declared question + params; free text is refused and unknown carries reason', () => {
  assert.equal(
    typeof atlas.askViaQuestionFront,
    'function',
    'packages/atlas/src/index.ts must export askViaQuestionFront(input) to mediate an optional LLM front.'
  );

  // Valid front: returns declared question + params -> renders reader answer with question, params, and witness
  const validResult = atlas.askViaQuestionFront({
    catalogue: CATALOGUE_FIXTURE,
    role: 'checker',
    locale: 'en',
    prompt: 'check subject-a',
    front: () => ({ question: 'grounds_by_subject', params: { subject: 'subject-a' } }),
    answers: READER_ANSWERS
  });
  assert.match(validResult.html, /data-answer="grounds_by_subject"/, 'Valid front choice must render declared question answer.');
  assert.ok(validResult.html.includes('subject-a'), 'Valid front output must show chosen parameters.');
  assert.match(validResult.html, /data-proof-ref="witness:subject-a:m-4"/, 'Valid front output must link to witness.');

  // Unknown reader answer -> renders data-state="unknown" with data-reason, no fabricated digits
  const unknownResult = atlas.askViaQuestionFront({
    catalogue: CATALOGUE_FIXTURE,
    role: 'checker',
    locale: 'en',
    prompt: 'check subject-gap',
    front: () => ({ question: 'grounds_by_subject', params: { subject: 'subject-gap' } }),
    answers: READER_ANSWERS
  });
  assert.match(unknownResult.html, /data-state="unknown"/, 'Unknown reader answer must render data-state="unknown".');
  assert.match(unknownResult.html, /data-reason="premise_missing"/, 'Unknown reader answer must carry its published data-reason.');

  // Free-text front -> refused; free prose MUST NOT appear in rendered output
  const freeProse = 'Yes, you definitely qualify for 136 EUR!';
  const refusedResult = atlas.askViaQuestionFront({
    catalogue: CATALOGUE_FIXTURE,
    role: 'checker',
    locale: 'en',
    prompt: 'do I qualify?',
    front: () => ({ freeText: freeProse }),
    answers: READER_ANSWERS
  });
  assert.ok(
    !refusedResult.html.includes(freeProse),
    'Question desk MUST refuse free text from an LLM front and never render prose without a Rezono row.'
  );
  assert.match(
    refusedResult.html,
    /data-state="unknown"/,
    'Refused free-text front response must render a structured data-state="unknown" refusal.'
  );
  assert.match(
    refusedResult.html,
    /data-reason=/,
    'Refused free-text front response must include a data-reason.'
  );
});
