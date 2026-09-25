// Ported from tests/false-positive-name-match.test.js.
// User feedback, off a real 928-transaction statement: a declared business name is unrelated to
// another sender whose name merely shares one ordinary word — an unrelated payment narrated
// "NIP/PBNL/HOMES DEALS VENTURES/..." was wrongly counted as an inflow from "Bright Homes Cleaning
// Solutions Ltd" purely because both names share the single ordinary word "HOMES".
// findInflowsMatchingName requires at least 2 of the declared name's distinctive words to appear in a
// transaction's narration (not just 1) before counting it as a match, so a genuine "BRIGHT HOMES
// CLEANING SOLUTIONS" payment still matches (it shares BRIGHT + HOMES + CLEANING + SOLUTIONS), while
// "HOMES DEALS VENTURES" — sharing only HOMES — no longer does.
import { findInflowsMatchingName } from '../classify';
import { txn } from './testHelpers';

test('a lone shared ordinary word ("HOMES") is not enough to count an unrelated payment as a match', () => {
  const txns = [
    txn({ narration: 'NIP/ROLEZ/BRIGHT HOMES CLEANING SOLUTIONS LTD/February Salary', credit: 350000, dateISO: '2026-02-15' }),
    txn({ narration: 'NIP/PBNL/HOMES DEALS VENTURES/Invoice 44', credit: 75000, dateISO: '2026-02-20' }),
  ];

  const { matches } = findInflowsMatchingName('Bright Homes Cleaning Solutions Ltd', txns);
  expect(matches.length).toBe(1);
  expect(matches[0].credit).toBe(350000);
  const total = matches.reduce((s, t) => s + t.credit, 0);
  expect(total).toBe(350000);
  expect(matches.some((t) => /HOMES DEALS VENTURES/i.test(t.narration))).toBe(false);
});

test('an applicant-confirmed "Fix name" correction lets a shortened narration still count, gated by the same word threshold', () => {
  const txns = [
    // This bank only ever shortens the employer's name to a bare fragment — nowhere near 2 distinctive
    // words of the full registered name, so it would never match without the confirmed correction.
    txn({ narration: 'SENDER: CRISP N', credit: 120000, dateISO: '2026-03-05' }),
  ];
  const resolve = (narration: string) => (narration === 'SENDER: CRISP N' ? 'Crisp N Clean Exclusive Solutions Ltd' : null);

  const withoutCorrection = findInflowsMatchingName('Crisp N Clean Exclusive Solutions Ltd', txns);
  expect(withoutCorrection.matches.length).toBe(0);

  const withCorrection = findInflowsMatchingName('Crisp N Clean Exclusive Solutions Ltd', txns, resolve);
  expect(withCorrection.matches.length).toBe(1);
});
