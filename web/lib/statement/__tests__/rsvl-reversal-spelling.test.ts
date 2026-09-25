// Ported from tests/rsvl-reversal-spelling.test.js.
// Real-data finding, off a real Zenith statement: isReversalNarration only recognised "RVSL" as a
// reversal marker, but the same real statement uses "RSVL" (letters transposed) far more often — e.g.
// "***RSVL NIP CR/MOB/TOBI BENSON/FBN / Grace CYC WEDDING SUPPORT", reversing an earlier failed
// outgoing transfer. Missing that spelling meant several reversed/bounced-back transfers were being
// counted as genuine new income. Calls isReversalNarration directly, and exercises the downstream
// effect via findInflowsMatchingName, mirroring the original test's "Found ... on 1 inflow, totaling
// ₦300,000" assertion (only the genuine, non-reversed payment should count).
import { isReversalNarration } from '../classify';
import { findInflowsMatchingName } from '../classify';
import { txn } from './testHelpers';

test('recognises "RSVL" (transposed letters) as a reversal marker, same as "RVSL"', () => {
  expect(isReversalNarration('***RSVL NIP CR/MOB/TOBI BENSON/FBN / Grace CYC WEDDING SUPPORT')).toBe(true);
  expect(isReversalNarration('NIP/RVSL/SOME TRANSFER')).toBe(true);
  expect(isReversalNarration('NIP/REVERSAL/SOME TRANSFER')).toBe(true);
  expect(isReversalNarration('NIP/BRIGHT HOMES CLEANING SOLUTIONS LTD/SALARY')).toBe(false);
});

test('a "***RSVL"-marked reversal credit is excluded from a matched-employer inflow total', () => {
  const txns = [
    txn({ narration: 'NIP/BRIGHT HOMES CLEANING SOLUTIONS LTD/SALARY', credit: 300000, dateISO: '2026-01-10' }),
    // The reversed/bounced-back duplicate — same employer name in the narration, but RSVL-marked.
    txn({ narration: '***RSVL NIP/BRIGHT HOMES CLEANING SOLUTIONS LTD/SALARY', credit: 300000, dateISO: '2026-01-12' }),
  ];

  const { matches } = findInflowsMatchingName('Bright Homes Cleaning Solutions Ltd', txns);
  expect(matches.length).toBe(1);
  const total = matches.reduce((s, t) => s + t.credit, 0);
  expect(total).toBe(300000);
});
