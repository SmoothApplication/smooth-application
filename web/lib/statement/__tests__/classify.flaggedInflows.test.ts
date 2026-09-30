// Direct instruction: "pick all transfers... even if the transfers are 1,000 times, 50,000 naira
// in 1,000 times and above, pick them, group them, name by name, according to names, according to
// different groups... group them to month by month... this 50K is for this month, it appeared 200
// times, you should fix it. Group them and ask for narration." Covers two things: (1)
// findUnexplainedLargeInflows no longer caps at 10, and (2) groupFlaggedInflows collapses repeat
// same-sender/same-month/same-amount inflows into one row with a count.
import { findUnexplainedLargeInflows, groupFlaggedInflows, inflowGroupKey } from '../classify';
import type { ParsedTxn } from '../types';

function txn(dateISO: string, credit: number, narration: string): ParsedTxn {
  return { date: new Date(dateISO), credit, debit: 0, balance: 0, narration };
}

describe('findUnexplainedLargeInflows (uncapped)', () => {
  test('returns every qualifying transaction, not just the first 10', () => {
    const txns: ParsedTxn[] = [];
    for (let i = 0; i < 25; i++) {
      // vague narration, no recognised keyword, above the ₦50,000 floor
      txns.push(txn(`2026-0${(i % 6) + 1}-15`, 60000 + i, 'XYZ REF ' + i));
    }
    const flagged = findUnexplainedLargeInflows(txns);
    expect(flagged.length).toBe(25);
  });

  test('still sorts by credit amount descending', () => {
    const txns = [txn('2026-01-01', 60000, 'ABC'), txn('2026-01-02', 90000, 'DEF'), txn('2026-01-03', 75000, 'GHI')];
    const flagged = findUnexplainedLargeInflows(txns);
    expect(flagged.map((t) => t.credit)).toEqual([90000, 75000, 60000]);
  });
});

describe('groupFlaggedInflows', () => {
  test('collapses many identical (sender, month, amount) transactions into one group with a count', () => {
    const txns: ParsedTxn[] = [];
    for (let i = 0; i < 200; i++) {
      txns.push(txn('2026-03-10', 50000, 'TUNDE BAKARE TRF'));
    }
    const flagged = findUnexplainedLargeInflows(txns);
    const groups = groupFlaggedInflows(flagged);
    expect(groups.length).toBe(1);
    expect(groups[0].count).toBe(200);
    expect(groups[0].amount).toBe(50000);
    expect(groups[0].total).toBe(200 * 50000);
    expect(groups[0].month).toBe('Mar 2026');
  });

  test('keeps the same sender in different months as separate groups', () => {
    const txns = [
      txn('2026-03-10', 50000, 'TUNDE BAKARE TRF'),
      txn('2026-04-10', 50000, 'TUNDE BAKARE TRF'),
    ];
    const groups = groupFlaggedInflows(findUnexplainedLargeInflows(txns));
    expect(groups.length).toBe(2);
    expect(groups.map((g) => g.month).sort()).toEqual(['Apr 2026', 'Mar 2026']);
  });

  test('keeps different amounts from the same sender in the same month as separate groups', () => {
    const txns = [
      txn('2026-03-10', 50000, 'TUNDE BAKARE TRF'),
      txn('2026-03-12', 75000, 'TUNDE BAKARE TRF'),
    ];
    const groups = groupFlaggedInflows(findUnexplainedLargeInflows(txns));
    expect(groups.length).toBe(2);
  });

  test('falls back to a narration snippet when no sender name can be extracted', () => {
    const txns = [txn('2026-03-10', 60000, '1234567890 REF CODE ONLY')];
    const groups = groupFlaggedInflows(findUnexplainedLargeInflows(txns));
    expect(groups.length).toBe(1);
    expect(groups[0].senderLabel.length).toBeGreaterThan(0);
  });

  test('sorts groups by total descending', () => {
    const txns = [
      txn('2026-03-01', 50000, 'AMAKA OKORO TRF'),
      txn('2026-03-02', 200000, 'CHINEDU EZE TRF'),
    ];
    const groups = groupFlaggedInflows(findUnexplainedLargeInflows(txns));
    expect(groups[0].total).toBeGreaterThanOrEqual(groups[1].total);
  });

  test('inflowGroupKey is stable for the same inputs', () => {
    const a = inflowGroupKey({ senderLabel: 'Tunde Bakare', month: 'Mar 2026', amount: 50000 });
    const b = inflowGroupKey({ senderLabel: 'Tunde Bakare', month: 'Mar 2026', amount: 50000.4 });
    expect(a).toBe(b); // amount is rounded before keying
  });

  test('returns no groups for an empty flagged list', () => {
    expect(groupFlaggedInflows([])).toEqual([]);
  });
});
