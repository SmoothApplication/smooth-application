// Ported from tests/consistent-senders-family-and-decode.test.js — items 9 and 8/10 only (item 6,
// "rank by distinct months not amount", is already covered by top-consistent-senders.test.ts). The
// original test's dropdown-UI assertions (narrower Family-reason dropdown options, the "What does this
// narration mean" toggle) are out of scope — this app has no such rendered UI wired up yet; only the
// underlying classification (buildIncomeSourceBreakdown's 'family' type) and decode (decodeNarration)
// functions exist.
//
// User feedback (10-item list, off a real Zenith bank statement):
//   9. "If you find any Surname similar to applicant from the bank statement group as Family."
//   8/10. Decode common Nigerian bank narration shorthand (NIP, ROLEZ = Moniepoint MFB, etc.) inline.
import { buildIncomeSourceBreakdown } from '../classify';
import { decodeNarration } from '../names';
import { txn } from './testHelpers';

test('a sender sharing the applicant\'s surname is grouped/typed as "family"; a non-matching sender is not', () => {
  const groups = buildIncomeSourceBreakdown(
    [
      txn({ narration: 'NIP TRF GOOD EMPLOYER LTD IFO TEST APPLICANT SMITH', credit: 100000, dateISO: '2026-01-10' }),
      txn({ narration: 'NIP TRF GOOD EMPLOYER LTD IFO TEST APPLICANT SMITH', credit: 100000, dateISO: '2026-02-10' }),
      txn({ narration: 'NIP TRF GOOD EMPLOYER LTD IFO TEST APPLICANT SMITH', credit: 100000, dateISO: '2026-03-10' }),
      txn({ narration: 'NIP TRF GOOD EMPLOYER LTD IFO TEST APPLICANT SMITH', credit: 100000, dateISO: '2026-04-10' }),
      txn({ narration: 'NIP/MARY SMITH/gift', credit: 12000, dateISO: '2026-01-20' }),
      txn({ narration: 'NIP/MARY SMITH/gift', credit: 9000, dateISO: '2026-02-25' }),
      txn({ narration: 'NIP/MARY SMITH/gift', credit: 11000, dateISO: '2026-03-28' }),
      txn({ narration: 'NIP/JOHN DOE VENTURES/proceeds', credit: 500000, dateISO: '2026-01-05' }),
    ],
    'Test Applicant Smith'
  );

  const marySmith = groups.find((g) => /mary smith/i.test(g.name));
  expect(marySmith).toBeDefined();
  expect(marySmith!.type).toBe('family');

  const johnDoe = groups.find((g) => /john doe ventures/i.test(g.name));
  expect(johnDoe).toBeDefined();
  expect(johnDoe!.type).not.toBe('family');
});

test('decodeNarration surfaces the bank narration glossary for recognised codes', () => {
  const parts = decodeNarration('NIP/ROLEZ/SOME SENDER/February Salary');
  const meanings = parts.map((p) => p.meaning).join(' ');
  expect(meanings).toMatch(/NIBSS Instant Payment/i);
  expect(meanings).toMatch(/Moniepoint MFB/i);
});
