// Ported from tests/employer-inflow-narration.test.js.
// User feedback: "state how many inflow comes in from the employer or business name extracted from the
// bank statement" — the employer/business cross-check now counts the actual CREDIT transactions whose
// own narration names the employer/business, totals them, and reads off a human "reason" segment (e.g.
// "February Salary") from bank-style slash-delimited narrations — including tolerating a truncated
// company suffix like "LIMITE" instead of "LIMITED"/"LTD". Calls findInflowsMatchingName,
// extractNarrationReason and canonicalizeNarrationReason directly, the pure functions the original
// test exercised indirectly through the full analyze-and-render UI flow.
import { findInflowsMatchingName, extractNarrationReason, canonicalizeNarrationReason } from '../classify';
import { txn } from './testHelpers';

test('employer: 3 matching credit inflows total correctly, with a canonicalized majority reason', () => {
  const txns = [
    txn({ narration: 'NIP/GRACE COVENANT YOUTH CHURCH/January Allowance', credit: 100000, dateISO: '2026-01-05' }),
    txn({ narration: 'NIP/GRACE COVENANT YOUTH CHURCH/February Allowance', credit: 100000, dateISO: '2026-02-05' }),
    txn({ narration: 'NIP/GRACE COVENANT YOUTH CHURCH/March Allowance', credit: 100000, dateISO: '2026-03-05' }),
  ];

  const { words, matches } = findInflowsMatchingName('Grace Covenant Youth Church', txns);
  expect(matches.length).toBe(3);
  const total = matches.reduce((s, t) => s + t.credit, 0);
  expect(total).toBe(300000);

  const reasons = matches.map((t) => canonicalizeNarrationReason(extractNarrationReason(t.narration, words)));
  reasons.forEach((r) => expect(r).toBe('Allowance'));
});

test('business: matches despite a truncated "LIMITE" company suffix, and canonicalizes per-month salary reasons together', () => {
  const txns = [
    txn({ narration: 'NIP/BRIGHT HOMES CLEANING SOLUTIONS LIMITE/January Salary', credit: 350000, dateISO: '2026-01-08' }),
    txn({ narration: 'NIP/BRIGHT HOMES CLEANING SOLUTIONS LIMITE/February Salary', credit: 350000, dateISO: '2026-02-08' }),
    txn({ narration: 'NIP/BRIGHT HOMES CLEANING SOLUTIONS LIMITE/March Salary', credit: 350000, dateISO: '2026-03-08' }),
  ];

  const { words, matches } = findInflowsMatchingName('Bright Homes Cleaning Solutions Ltd', txns);
  expect(matches.length).toBe(3);
  const total = matches.reduce((s, t) => s + t.credit, 0);
  expect(total).toBe(1050000);

  // "January Salary", "February Salary", "March Salary" are 3 distinct raw narrations but should all
  // canonicalize to the SAME reason ("Salary"), so they tally as one recurring reason, not three
  // separate one-off ones.
  const reasons = matches.map((t) => canonicalizeNarrationReason(extractNarrationReason(t.narration, words)));
  reasons.forEach((r) => expect(r).toBe('Salary'));
});

test('a name genuinely absent from the statement produces zero matches', () => {
  const txns = [
    txn({ narration: 'NIP/GRACE COVENANT YOUTH CHURCH/January Allowance', credit: 100000, dateISO: '2026-01-05' }),
  ];
  const { matches } = findInflowsMatchingName('Totally Unrelated Employer Xyzabc', txns);
  expect(matches.length).toBe(0);
});
