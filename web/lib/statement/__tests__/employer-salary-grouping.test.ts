import { buildIncomeSourceBreakdown } from '../classify';
import { buildLetterPayload } from '@/lib/letter';
import { DEFAULT_ANSWERS } from '@/lib/checklist/types';
import { suggestReasonForGroup } from '../suggestReason';
import { UNEXPLAINED_REASON_OPTIONS } from '../flaggedReasons';
import type { ParsedTxn } from '../types';

const t = (d: string, credit: number, narration: string): ParsedTxn => ({ date: new Date(d), credit, debit: 0, balance: 0, narration });
const remita = [
  t('2026-03-18', 654071.67, 'REMITA INFLOW R-1445788162/NIGERIAN U:STAFFSALARYFORMARCH2026:CBN:14457955/9014457881620'),
  t('2026-03-31', 3786435, 'REMITA INFLOW R-1450000001/NIGERIAN U:2NDQUARTERALLOWANCES2026TOSTAFF:CBN:14500000/9014500000001'),
  t('2026-04-23', 654071.67, 'REMITA INFLOW R-1458479293/NIGERIAN U:STAFFSALARYFORAPRIL2026:CBN:14586777/9014584792930'),
  t('2026-05-05', 9500000, 'REMITA INFLOW R-1463000002/NIGERIAN U:ANNUALINTERVENTIONALLOWANCETONUPRCST:CBN:14630000/9014630000002'),
  t('2026-05-21', 648358.4, 'REMITA INFLOW R-1468069461/NIGERIAN U:MAY2026NUPRCSTAFFSALARY:CBN:14681127/9014680694610'),
  t('2026-08-29', 2155952.84, 'REMITA INFLOW R-1500000003/NIGERIAN U:ENDOFNEGOTIATIONBONUS:CBN:15000000/9015000000003'),
];

describe('declared employer pulls every employer payment into Salary', () => {
  it('without an employer only salary-worded payments are Salary', () => {
    const g = buildIncomeSourceBreakdown(remita, 'JANE DOE', null, undefined, { minInflow: 50000, dropReversals: true });
    expect(g.find((x) => x.type === 'salary')!.count).toBe(3);
  });
  it('with the employer typed in, allowances and bonuses join the Salary group', () => {
    const g = buildIncomeSourceBreakdown(remita, 'JANE DOE', null, undefined, { minInflow: 50000, dropReversals: true, employerName: 'Nigerian Upstream Petroleum' });
    const sal = g.find((x) => x.type === 'salary')!;
    expect(sal.count).toBe(6);
    expect(g.filter((x) => x.type !== 'salary' && /nigerian/i.test(x.name))).toHaveLength(0);
  });
  it('the letter keeps salary as the monthly figure and lists allowances separately', () => {
    const groups = buildIncomeSourceBreakdown(remita, 'JANE DOE', null, undefined, { minInflow: 50000, dropReversals: true, employerName: 'Nigerian Upstream Petroleum' });
    const p = buildLetterPayload({
      countryName: 'United Kingdom', visaName: 'Standard Visitor visa', applicantName: 'Jane Doe',
      answers: { ...DEFAULT_ANSWERS, purpose: 'tourism' }, employed: true, selfEmployed: false,
      employerName: 'Nigerian Upstream Petroleum', businessName: '', groups, statementSummaries: [],
      totalInflow: 0, totalOutflow: 0, openingBalance: 0, closingBalance: 0, financialInputs: null,
    });
    const text = p.incomeParagraphs.join(' ');
    expect(text).toContain('averaging ₦652,167'); // (654071.67+654071.67+648358.4)/3
    expect(text).toContain('allowances and bonuses totalling');
    expect(p.incomeRows.length).toBe(3);
  });
});

describe('salary is a choice in the reason dropdown', () => {
  it('has Salary and Allowance options and suggests Salary for the Salary group', () => {
    expect(UNEXPLAINED_REASON_OPTIONS.map((o) => o.value)).toEqual(expect.arrayContaining(['salary', 'allowance']));
    const g = buildIncomeSourceBreakdown(remita, 'JANE DOE', null, undefined, { minInflow: 50000, dropReversals: true });
    expect(suggestReasonForGroup(g.find((x) => x.type === 'salary')!)?.value).toBe('salary');
  });
});

import { buildIncomeBreakdownAoa } from '../exportBreakdown';
describe('sheet shows employer pay as Salary + Allowances sections', () => {
  it('splits into two subtotals that add up to the same total', () => {
    const groups = buildIncomeSourceBreakdown(remita, 'JANE DOE', null, undefined, { minInflow: 50000, dropReversals: true, employerName: 'Nigerian Upstream Petroleum' });
    const aoa = buildIncomeBreakdownAoa(groups, (n) => n);
    const subs = aoa.filter((r) => String(r[4] || '').startsWith('Subtotal for'));
    expect(subs.map((r) => r[4])).toEqual(['Subtotal for Salary:', 'Subtotal for Allowances and bonuses from employer:']);
    const sum = Number(subs[0][5]) + Number(subs[1][5]);
    const grand = aoa.find((r) => String(r[4] || '').toUpperCase().includes('GRAND TOTAL'));
    expect(Math.round(sum)).toBe(Math.round(remita.reduce((a, x) => a + x.credit, 0)));
    expect(grand).toBeTruthy();
  });
});
