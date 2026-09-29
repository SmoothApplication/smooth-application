// Task #430 (found via a live audit against the original GitHub Pages site's "Advanced details"
// dropdown, which still lists "Top 10 inflows" as its own shortcut — a check that was never part
// of this Next.js port's regression suite because the function itself had never been ported).
// Ported from index.html's getTopInflows (~lines 13635-13638).
import { getTopInflows } from '../classify';
import { txn } from './testHelpers';

test('ranks by raw credit amount, largest first, not by sender consistency', () => {
  const txns = [
    txn({ narration: 'NIP/CHIDI OKAFOR/TRF', credit: 10000, dateISO: '2026-01-05' }),
    txn({ narration: 'NIP/BIG ONE-OFF GIFT/TRF', credit: 500000, dateISO: '2026-01-10' }),
    txn({ narration: 'NIP/CHIDI OKAFOR/TRF', credit: 10000, dateISO: '2026-02-05' }),
    txn({ narration: 'NIP/CHIDI OKAFOR/TRF', credit: 10000, dateISO: '2026-03-05' }),
  ];
  const result = getTopInflows(txns, 10);
  // The single 500000 one-off outranks Chidi Okafor's three separate 10000 payments, even though
  // Chidi Okafor would rank #1 in getTopConsistentSenders (3 distinct months) - these are
  // deliberately different rankings answering different questions.
  expect(result[0].credit).toBe(500000);
  expect(result.length).toBe(4);
});

test('excludes debits (only counts credit > 0) and respects the n limit', () => {
  const txns = [
    txn({ narration: 'A', credit: 1000, dateISO: '2026-01-01' }),
    txn({ narration: 'B', debit: 5000, dateISO: '2026-01-02' }),
    txn({ narration: 'C', credit: 2000, dateISO: '2026-01-03' }),
    txn({ narration: 'D', credit: 3000, dateISO: '2026-01-04' }),
  ];
  const result = getTopInflows(txns, 2);
  expect(result.length).toBe(2);
  expect(result.map((t) => t.credit)).toEqual([3000, 2000]);
});

test('defaults to top 10 when n is omitted', () => {
  const txns = Array.from({ length: 15 }, (_, i) =>
    txn({ narration: `Payment ${i}`, credit: (i + 1) * 1000, dateISO: '2026-01-0' + ((i % 9) + 1) })
  );
  const result = getTopInflows(txns);
  expect(result.length).toBe(10);
  expect(result[0].credit).toBe(15000);
});
