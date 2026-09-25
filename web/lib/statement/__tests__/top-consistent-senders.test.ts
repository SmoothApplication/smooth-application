// Ported from index.html's getTopConsistentSenders (~lines 13680-13717) — Phase 3 needed this for the
// Analysis tab's "Top 10 senders" table but it wasn't part of Phase 1's ported function list, so it's
// added here alongside its own test.
import { getTopConsistentSenders } from '../classify';
import { txn } from './testHelpers';

test('ranks senders by distinct months seen, then payment count, then total amount', () => {
  const txns = [
    // Chidi Okafor: 3 distinct months, 3 payments, 30000 total - most consistent
    txn({ narration: 'NIP/CHIDI OKAFOR/TRF', credit: 10000, dateISO: '2026-01-05' }),
    txn({ narration: 'NIP/CHIDI OKAFOR/TRF', credit: 10000, dateISO: '2026-02-05' }),
    txn({ narration: 'NIP/CHIDI OKAFOR/TRF', credit: 10000, dateISO: '2026-03-05' }),
    // Bright Homes Cleaning Ltd: 2 distinct months, 2 payments, 50000 total - fewer months, more money
    txn({ narration: 'NIP/BRIGHT HOMES CLEANING LTD/SALARY', credit: 25000, dateISO: '2026-01-10' }),
    txn({ narration: 'NIP/BRIGHT HOMES CLEANING LTD/SALARY', credit: 25000, dateISO: '2026-02-10' }),
    // A one-off, unrelated payment
    txn({ narration: 'NIP/YARO HASSAN/GIFT', credit: 5000, dateISO: '2026-01-20' }),
  ];

  const result = getTopConsistentSenders(txns, 10, 'Applicant Name');
  expect(result.list[0].name).toBe('Chidi Okafor');
  expect(result.list[0].monthCount).toBe(3);
  expect(result.list[0].count).toBe(3);
  expect(result.list[0].total).toBe(30000);

  const bright = result.list.find((r) => /Bright Homes/i.test(r.name));
  expect(bright).toBeDefined();
  expect(bright!.monthCount).toBe(2);
  expect(bright!.total).toBe(50000);

  expect(result.list.length).toBeLessThanOrEqual(10);
});

test('excludes reversals and non-income charges, and never surfaces the applicant\'s own name', () => {
  const txns = [
    txn({ narration: 'NIP/JOHN SMITH/TRF', credit: 20000, dateISO: '2026-01-05' }),
    txn({ narration: 'NIP/JOHN SMITH/TRF RVSL', credit: 20000, dateISO: '2026-01-06' }),
    txn({ narration: 'Mobile USSDAirtime N500.00 to 08012345678', credit: 500, dateISO: '2026-01-07' }),
    txn({ narration: 'NIP FROM APPLICANT NAME TO JOHN SMITH/TRF', credit: 20000, dateISO: '2026-02-05' }),
  ];
  const result = getTopConsistentSenders(txns, 10, 'Applicant Name');
  const names = result.list.map((r) => r.name);
  expect(names).not.toContain('Applicant Name');
  expect(names.filter((n) => /John Smith/i.test(n)).length).toBe(1);
});
