// User request after a real Providus statement: (1) selectable inflow floor with everything under
// ₦50,000 ignored, (2) reversals dropped from the report, (3) sender names must be real names only:
// reference codes, initials, narration words and a wrapped copy of the applicant's own name must not
// become "senders".
import { buildIncomeSourceBreakdown, findUnexplainedLargeInflows } from '../classify';
import { extractNameCandidates, senderSideCandidates, isLikelyApplicantsOwnName } from '../names';
import type { ParsedTxn } from '../types';

function cr(narration: string, amount: number, day = 5, month = 4): ParsedTxn {
  return { date: new Date(2026, month, day), narration, credit: amount, debit: 0, balance: 0 } as ParsedTxn;
}

describe('inflow floor', () => {
  const txns = [
    cr('NIP/ABUBAKAR SALEH/Transfer from ABUBAKAR SALEH', 49999, 1),
    cr('NIP/CHIOMA OKAFOR/rent', 50000, 2),
    cr('NIP/TUNDE BAKARE/contract', 150000, 3),
    cr('NIP/AMAKA NWOSU/sale', 250000, 4),
  ];
  const names = (min: number) =>
    buildIncomeSourceBreakdown(txns, 'Test Applicant', '', undefined, { minInflow: min }).map((g) => g.name);

  test('50k floor drops 49,999 but keeps exactly 50,000', () => {
    const n = names(50000).join('|');
    expect(n).not.toMatch(/Abubakar/);
    expect(n).toMatch(/Chioma/);
  });
  test('100k floor drops 50,000', () => {
    const n = names(100000).join('|');
    expect(n).not.toMatch(/Chioma/);
    expect(n).toMatch(/Tunde/);
  });
  test('200k floor keeps only 250,000', () => {
    const n = names(200000).join('|');
    expect(n).not.toMatch(/Tunde/);
    expect(n).toMatch(/Amaka/);
  });
  test('findUnexplainedLargeInflows with a floor ignores blank narrations beneath it', () => {
    const t = [cr('', 30000), cr('', 120000)];
    expect(findUnexplainedLargeInflows(t, 50000)).toHaveLength(1);
    expect(findUnexplainedLargeInflows(t)).toHaveLength(2); // old default unchanged
  });
});

describe('reversals', () => {
  const txns = [cr('RVSL NIP/FAILED TRANSFER', 80000), cr('NIP/TUNDE BAKARE/contract', 90000, 6)];
  test('dropped when asked', () => {
    const g = buildIncomeSourceBreakdown(txns, 'Test Applicant', '', undefined, { dropReversals: true });
    expect(g.some((x) => x.type === 'reversal')).toBe(false);
  });
  test('still shown by default (backward compatible)', () => {
    const g = buildIncomeSourceBreakdown(txns, 'Test Applicant');
    expect(g.some((x) => x.type === 'reversal')).toBe(true);
  });
});

describe('name cleanup', () => {
  test('reference code and trailing initial are not part of the name', () => {
    const n = extractNameCandidates('ETI NXG MOBILE TRF TO ZIB Refund Olamide O FRM EKIM HANNAH I 09FG260518163147453KB8VIL');
    expect(n).toContain('EKIM HANNAH');
    expect(n.join('|')).not.toMatch(/KB|VIL|FG/);
  });
  test('"Petrol At" is not a name', () => {
    expect(extractNameCandidates('ISW petrol/AT117 TRF 2MPTj92cg 2066773772527845376 CR|MNP|ZIB|160626074401|513297')).toEqual([]);
  });
  test('wrapped applicant name is recognised as the applicant, not a sender', () => {
    expect(isLikelyApplicantsOwnName('Oluw Aseyi Afeni', 'Oluwaseyi Adegboyega Afeni')).toBe(true);
    // a different person sharing one word is untouched
    expect(isLikelyApplicantsOwnName('Sola Afeni', 'Oluwaseyi Adegboyega Afeni')).toBe(false);
  });
  test('UPI narration yields no fake sender made of codes plus the applicant name', () => {
    const c = senderSideCandidates(
      'UPF05726052514331000206230837 7/UP-IB Online Transfer|UPI-108941656yb7XYoXDjLYTr5//20260525/OLUWASEYI AFENI/PURCHASE|SANN',
      'Oluwaseyi Adegboyega Afeni'
    );
    expect(c.join('|')).not.toMatch(/Xyox|Yb|Purchase|Upi/i);
  });
});
