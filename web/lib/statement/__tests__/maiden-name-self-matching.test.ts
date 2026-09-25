// Ported from tests/maiden-name-self-matching.test.js.
// User request: "Create female and ask if the applicant is married ask for maiden name. Use maiden
// name and married name to trace all inflows. All inflows in maiden name and married name should be
// taken to self." A married woman's bank statement can carry her maiden name on some transactions (an
// account opened before marriage, a recipient-side name never updated, a relative still using the old
// name) and her married/current name on others — both are genuinely her own money moving between her
// own accounts. buildIncomeSourceBreakdown takes an optional maidenName parameter, folding it in as
// one more holder-name variant alongside the auto-detected ones — so a sender-side candidate matching
// EITHER the typed passport name or the maiden name routes to Self.
import { buildIncomeSourceBreakdown } from '../classify';
import { txn } from './testHelpers';

const baseTxns = [
  txn({ narration: 'NIP TRF GOOD EMPLOYER LTD IFO CHIDINMA EZE', credit: 300000, dateISO: '2026-01-15' }),
  txn({ narration: 'NIP TRF GOOD EMPLOYER LTD IFO CHIDINMA EZE', credit: 300000, dateISO: '2026-02-15' }),
  txn({ narration: 'NIP TRF GOOD EMPLOYER LTD IFO CHIDINMA EZE', credit: 300000, dateISO: '2026-03-15' }),
  // Same person, narrated under her MAIDEN name — a bank account opened before marriage.
  txn({ narration: 'BANKNIP From 000014 PAYREF: - SENDER: CHIDINMA OKAFOR', credit: 15000, dateISO: '2026-04-01' }),
];

test('a maiden-name-matching sender routes to Self when the maiden name is supplied', () => {
  const groups = buildIncomeSourceBreakdown(baseTxns, 'Chidinma Eze', 'Chidinma Okafor');
  const selfGroups = groups.filter((g) => g.type === 'self');
  expect(selfGroups.length).toBe(1);
  expect(selfGroups[0].total).toBe(15000);
});

test('without the maiden name on file, the same payment is not classified as Self', () => {
  const groups = buildIncomeSourceBreakdown(baseTxns, 'Chidinma Eze');
  const selfGroups = groups.filter((g) => g.type === 'self');
  expect(selfGroups.length).toBe(0);
});
