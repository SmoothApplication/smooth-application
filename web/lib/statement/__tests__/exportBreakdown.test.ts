// Task #432 (found via the same live audit as top-inflows.test.ts): index.html's "Download
// spreadsheet" button was never carried over to this port. buildIncomeBreakdownAoa is the pure,
// testable half of that feature (the actual XLSX.writeFile call lives in StatementDashboard.tsx,
// since it needs the browser's download machinery).
import { summarizeSourceGroup } from '../classify';
import { buildIncomeBreakdownAoa } from '../exportBreakdown';
import { txn } from './testHelpers';
import type { SourceGroups } from '../types';

const identity = (n: string) => n;

test('builds a header row, one row per transaction, a subtotal, and a grand total', () => {
  const g1 = summarizeSourceGroup(
    'Chidi Okafor',
    [
      txn({ narration: 'NIP/CHIDI OKAFOR/FEBRUARY SALARY', credit: 150000, dateISO: '2026-02-05' }),
      txn({ narration: 'NIP/CHIDI OKAFOR/MARCH SALARY', credit: 150000, dateISO: '2026-03-05' }),
    ],
    'salary'
  );
  const groups = [g1] as SourceGroups;

  const aoa = buildIncomeBreakdownAoa(groups, identity);

  expect(aoa[0]).toEqual([
    'Source',
    'Type',
    'Date',
    'Amount (NGN)',
    'Reason (from narration)',
    'Narration',
    'Your explanation',
  ]);
  // First transaction row carries the source name/type; the second (same group) row's first two
  // columns are blank - same "shown once" convention as the on-screen SourceGroupCard.
  expect(aoa[1][0]).toBe('Chidi Okafor');
  expect(aoa[1][1]).toBe('salary');
  expect(aoa[2][0]).toBe('');
  expect(aoa[2][1]).toBe('');
  // Subtotal row, then a blank spacer row, then the grand total as the very last row.
  const subtotalRow = aoa.find((r) => String(r[4]).startsWith('Subtotal for'));
  expect(subtotalRow).toBeDefined();
  expect(subtotalRow![5]).toBe(300000);
  const lastRow = aoa[aoa.length - 1];
  expect(lastRow[4]).toBe('GRAND TOTAL:');
  expect(lastRow[5]).toBe(300000);
});

test('applies displayName (Fix Name corrections) to the Source column and subtotal label', () => {
  const g1 = summarizeSourceGroup(
    'ONB CHIDI OKFR',
    [txn({ narration: 'NIP/ONB CHIDI OKFR/TRF', credit: 20000, dateISO: '2026-01-05' })],
    'personal'
  );
  const groups = [g1] as SourceGroups;
  const displayName = (raw: string) => (raw === 'ONB CHIDI OKFR' ? 'Chidi Okafor' : raw);

  const aoa = buildIncomeBreakdownAoa(groups, displayName);

  expect(aoa[1][0]).toBe('Chidi Okafor');
  const subtotalRow = aoa.find((r) => String(r[4]).startsWith('Subtotal for'));
  expect(subtotalRow![4]).toBe('Subtotal for Chidi Okafor:');
});

test('prepends a missing-salary-months warning row when present', () => {
  const g1 = summarizeSourceGroup(
    'Salary',
    [txn({ narration: 'FEBRUARY SALARY', credit: 100000, dateISO: '2026-02-05' })],
    'salary'
  );
  const groups = [g1] as SourceGroups;
  groups.missingSalaryMonths = ['March'];

  const aoa = buildIncomeBreakdownAoa(groups, identity);

  expect(aoa[1][0]).toBe('⚠️ Possibly missing:');
  expect(aoa[1][5]).toBe('March Salary');
  expect(aoa[2]).toEqual([]);
});

test('includes the explanation on the group\'s first row only, keyed by raw group name', () => {
  const g1 = summarizeSourceGroup(
    'Aunty Blessing',
    [txn({ narration: 'NIP/GIFT FROM AUNTY BLESSING', credit: 300000, dateISO: '2026-04-20' })],
    'personal'
  );
  const groups = [g1] as SourceGroups;

  const aoa = buildIncomeBreakdownAoa(groups, identity, { 'Aunty Blessing': 'A birthday gift from my aunt' });

  expect(aoa[1][6]).toBe('A birthday gift from my aunt');
});

test('leaves the explanation column blank for reversal/self/interest/internal groups', () => {
  // No test-level enforcement needed here beyond the shape — the "no explanation needed" gate
  // lives in the UI (StatementDashboard's `needsExplanation`), not in buildIncomeBreakdownAoa
  // itself, so a group simply carries whatever the explanations map has for its name (or nothing).
  const g1 = summarizeSourceGroup('Interest', [txn({ narration: 'Interest Earned', credit: 500, dateISO: '2026-01-05' })], 'interest');
  const groups = [g1] as SourceGroups;
  const aoa = buildIncomeBreakdownAoa(groups, identity);
  expect(aoa[1][6]).toBe('');
});

test('does not exclude a salary/interest/internal bucket name from its own Reason extraction', () => {
  // Regression for the exact exception ported from index.html's own aoa builder — "Salary" is a
  // synthetic bucket label, not a real sender name. If it were wrongly treated as a "name word" to
  // strip out of the narration, this candidate reason segment (which itself contains the word
  // "SALARY") would be excluded as "the sender's own name overlapping the reason", leaving the
  // Reason column empty even though a perfectly good reason is right there in the narration.
  const g1 = summarizeSourceGroup(
    'Salary',
    [txn({ narration: 'SALARY FOR FEBRUARY', credit: 100000, dateISO: '2026-02-05' })],
    'salary'
  );
  const groups = [g1] as SourceGroups;
  const aoa = buildIncomeBreakdownAoa(groups, identity);
  const row = aoa[1];
  // Columns: [Source, Type, Date, Amount, Reason, Narration] — index 4 is Reason.
  expect(row[4]).toBe('SALARY FOR FEBRUARY');
  expect(row[4]).not.toBe('');
});
