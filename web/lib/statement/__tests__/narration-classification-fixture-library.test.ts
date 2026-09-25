// Ported from tests/narration-classification-fixture-library.test.js.
// Consolidated fixture library for the bank-statement narration classifier
// (buildIncomeSourceBreakdown / identifyStableIncome and their helpers: isReversalNarration,
// isInterestEarnedNarration, isNonIncomeChargeNarration, self-transfer detection, sender-name
// extraction). This is the single highest-recurring bug class in the app — real user statements
// keep surfacing new narration shapes that the classifier has never seen. This is a fast,
// table-driven regression net that runs every known narration shape through the classifier in one
// place, checking the classifier's priority ordering (charge -> reversal -> interest -> self ->
// salary -> named -> other) against every past bug in one shot.
import { buildIncomeSourceBreakdown } from '../classify';
import { txn } from './testHelpers';

const APPLICANT_NAME = 'AGBOOLA MARY OLUWAFUNMILAYO';

type ExpectType = 'interest' | 'reversal-excluded' | 'charge-excluded' | 'self' | 'salary' | 'personal';

interface Fixture {
  narration: string;
  credit: number;
  dateISO: string;
  expectType: ExpectType;
  note: string;
}

const FIXTURES: Fixture[] = [
  {
    narration: '07 Aug 2026 01:40:30 OWealth Interest Earned -- Mobile uJ 260808994uHYYGJHzJblKYq3Jmt1',
    credit: 1, dateISO: '2026-08-07', expectType: 'interest',
    note: 'Opay OWealth auto-interest credit, no sender name at all (interest-earned-narration.test.js)',
  },
  {
    narration: '***RSVL NIP CR/MOB/TOBI BENSON/FBN / Grace CYC WEDDING SUPPORT',
    credit: 15000, dateISO: '2026-05-11', expectType: 'reversal-excluded',
    note: '"RSVL" (letters transposed from RVSL) reversal marker (rsvl-reversal-spelling.test.js)',
  },
  {
    narration: '2026-04-27 2849426152/0000012 Mobile USSDAirtime N500.00 to 6042621510383314428 07084198281 RefId 4277',
    credit: 500, dateISO: '2026-04-27', expectType: 'charge-excluded',
    note: 'Self-service airtime top-up, not income (airtime-sms-charge-not-income.test.js)',
  },
  {
    narration: '2026-06-09 3074749739 - SMS NOTIFICATION CHARGE FOR 2026 MAY 8TH-14TH MAY 2026',
    credit: 561, dateISO: '2026-06-09', expectType: 'charge-excluded',
    note: 'Bank SMS-notification fee, not income (airtime-sms-charge-not-income.test.js)',
  },
  {
    narration: 'BANKNIP From 000014 PAYREF: - SENDER: AGBOOLA MARY OLUWAFUNMILAYO',
    credit: 20000, dateISO: '2026-02-04', expectType: 'self',
    note: 'Applicant transferring to herself, own full name as "sender" (stray-payment-no-false-salary-from-self-bucket.test.js)',
  },
  {
    narration: 'NIP TRF FROM ADISA BILIKIS ABIOLA',
    credit: 960000, dateISO: '2026-07-30', expectType: 'personal',
    note: 'Genuine real-named third-party sender, must classify normally (interest-earned-narration.test.js)',
  },
  {
    narration: '3373260214/10000226 - AFRC - 080615544100155048 4891',
    credit: 18730, dateISO: '2026-08-06', expectType: 'personal',
    note: 'Blank/coded narration, isolated one-off amount — must NOT ride into Salary just because it rounds to the same bucket as unrelated self-transfers (stray-payment-no-false-salary-from-self-bucket.test.js)',
  },
];

describe('narration classification fixture library', () => {
  const salaryTxns = [
    txn({ narration: 'NIP TRF GOOD EMPLOYER LTD IFO TEST APPLICANT SMITH', credit: 300000, dateISO: '2026-01-15' }),
    txn({ narration: 'NIP TRF GOOD EMPLOYER LTD IFO TEST APPLICANT SMITH', credit: 300000, dateISO: '2026-02-15' }),
    txn({ narration: 'NIP TRF GOOD EMPLOYER LTD IFO TEST APPLICANT SMITH', credit: 300000, dateISO: '2026-03-15' }),
  ];
  const fixtureTxns = FIXTURES.map((f) => txn({ narration: f.narration, credit: f.credit, dateISO: f.dateISO }));
  const groups = buildIncomeSourceBreakdown(salaryTxns.concat(fixtureTxns), APPLICANT_NAME, '');

  test.each(FIXTURES)('$expectType: $note', (fx) => {
    if (fx.expectType === 'interest') {
      const interestGroups = groups.filter((g) => g.type === 'interest');
      expect(interestGroups.length).toBeGreaterThanOrEqual(1);
      expect(interestGroups.some((g) => g.count >= 1)).toBe(true);
      const garbled = groups.some((g) => g.type !== 'interest' && /Earned|Owealth/i.test(g.name || ''));
      expect(garbled).toBe(false);
    } else if (fx.expectType === 'reversal-excluded' || fx.expectType === 'charge-excluded') {
      // Reversal/charge narrations must never surface as their own named group (personal/salary/other).
      const asNamed = groups.some(
        (g) =>
          ['personal', 'salary', 'other'].indexOf(g.type) !== -1 &&
          fx.narration.split(/\s+/).some((word) => word.length > 3 && (g.name || '').indexOf(word) !== -1)
      );
      expect(asNamed).toBe(false);
    } else if (fx.expectType === 'self') {
      const selfGroups = groups.filter((g) => g.type === 'self');
      expect(selfGroups.length).toBeGreaterThanOrEqual(1);
    } else if (fx.expectType === 'personal') {
      // Must not have been silently swallowed into Salary alongside the unrelated 3x ₦300,000 employer payments.
      const salaryGroup = groups.filter((g) => g.type === 'salary')[0];
      if (salaryGroup) {
        expect(salaryGroup.total).toBe(900000);
      }
    }
  });

  test('genuine recurring salary survives all fixtures untouched', () => {
    const salaryGroups = groups.filter((g) => g.type === 'salary');
    expect(salaryGroups.length).toBe(1);
    expect(salaryGroups[0].total).toBe(900000);
    expect(salaryGroups[0].count).toBe(3);
  });
});
