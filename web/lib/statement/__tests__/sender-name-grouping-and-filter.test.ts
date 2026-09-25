// Ported from tests/sender-name-grouping-and-filter.test.js.
// User request, verbatim: "if you see a funmi Agboola or agboola funmi pick it as the same name...
// group the similar together and create where the applicants can confirm if they are the same
// persons. names that appear once. For example if you see funmi afeni and a funmi agboola, you put
// it as a group and ask if they are the same person or not. For the names, remove all unnecessary
// figures that does not look like a name... it must be strictly names that should be extracted,
// names alone."
//
// Three behaviors, tested here directly against the ported pure functions (the original drove this
// through __testGetTopConsistentSenders/__testExtractNameCandidates DOM escape hatches; here we call
// mergeNameVariants/applySenderDuplicateDecisions/extractNameCandidates directly, which is exactly
// what those escape hatches wrapped):
//   1. Two candidate names that are the exact same WORDS, just reordered ("Chidi Nwosu" / "Nwosu
//      Chidi") merge automatically via sameWordSet() inside mergeNameVariants — never even reaching
//      the ask-the-user prompt.
//   2. A name seen only ONCE (a singleton) that shares even just a single significant word with
//      another sender gets flagged to ask about — relaxed from the general 2-shared-word rule, which
//      still applies (and still does NOT flag) two non-singleton senders sharing one common first name.
//   3. extractNameCandidates drops any 3+ letter word with no vowel sound in it — see looksNameShaped().
import { mergeNameVariants, applySenderDuplicateDecisions } from '../classify';
import { extractNameCandidates } from '../names';
import { txn } from './testHelpers';
import type { ParsedTxn } from '../types';

test('exact-same-words-reordered names merge automatically; singleton-sharing-one-word pairs get flagged, non-singletons do not', () => {
  const namedGroups: Record<string, ParsedTxn[]> = {
    'Chidi Nwosu': [
      txn({ narration: 'NIP/CHIDI NWOSU/TRF', credit: 20000, dateISO: '2026-01-15' }),
      txn({ narration: 'NIP/CHIDI NWOSU/TRF', credit: 20000, dateISO: '2026-02-15' }),
    ],
    'Nwosu Chidi': [txn({ narration: 'NIP/NWOSU CHIDI/TRF', credit: 20000, dateISO: '2026-03-15' })],
    'Yaro Hassan': [txn({ narration: 'NIP/YARO HASSAN/TRF', credit: 15000, dateISO: '2026-01-20' })],
    'Yaro Ibrahim': [
      txn({ narration: 'NIP/YARO IBRAHIM/TRF', credit: 18000, dateISO: '2026-01-25' }),
      txn({ narration: 'NIP/YARO IBRAHIM/TRF', credit: 18000, dateISO: '2026-02-25' }),
      txn({ narration: 'NIP/YARO IBRAHIM/TRF', credit: 18000, dateISO: '2026-03-25' }),
    ],
    'David Okoro': [
      txn({ narration: 'NIP/DAVID OKORO/TRF', credit: 9000, dateISO: '2026-01-05' }),
      txn({ narration: 'NIP/DAVID OKORO/TRF', credit: 9000, dateISO: '2026-02-05' }),
    ],
    'David Chukwu': [
      txn({ narration: 'NIP/DAVID CHUKWU/TRF', credit: 9500, dateISO: '2026-01-10' }),
      txn({ narration: 'NIP/DAVID CHUKWU/TRF', credit: 9500, dateISO: '2026-02-10' }),
    ],
  };

  const merged = mergeNameVariants(namedGroups);
  expect(Object.keys(merged)).not.toContain('Nwosu Chidi');
  expect(merged['Chidi Nwosu']).toBeDefined();
  expect(merged['Chidi Nwosu'].length).toBe(3);

  const { pending } = applySenderDuplicateDecisions(merged);
  expect(pending.length).toBe(1);
  const pair = pending[0];
  expect(/Yaro Hassan/i.test(pair.nameA) || /Yaro Hassan/i.test(pair.nameB)).toBe(true);
  expect(/Yaro Ibrahim/i.test(pair.nameA) || /Yaro Ibrahim/i.test(pair.nameB)).toBe(true);
  const flaggedNames = JSON.stringify(pending);
  expect(/David/i.test(flaggedNames)).toBe(false);
});

test('extractNameCandidates drops vowel-less reference codes glued directly onto a real name', () => {
  const cases = [
    // "ZQX" (no vowel, never listed as a stopword) sits directly before a real name with nothing
    // separating them.
    { narration: 'NIP/ZQX/JOHN SMITH/TRF', expectClean: 'John Smith', mustNotContain: 'ZQX' },
    // Same idea, trailing this time.
    { narration: 'NIP/MARY OKON/XRTS/TRF', expectClean: 'Mary Okon', mustNotContain: 'XRTS' },
  ];
  cases.forEach((c) => {
    const candidates = extractNameCandidates(c.narration);
    const joined = candidates.join(' | ');
    const junkRe = new RegExp('\\b' + c.mustNotContain + '\\b', 'i');
    expect(junkRe.test(joined)).toBe(false);
    const titleCased = candidates.map((s) => s.toLowerCase().replace(/\b[a-z]/g, (ch) => ch.toUpperCase()));
    expect(titleCased).toContain(c.expectClean);
  });
});
