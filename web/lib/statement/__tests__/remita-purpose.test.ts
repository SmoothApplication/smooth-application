// Real Providus Remita narrations (Adepeju Popoola): the purpose is glued into one token.
import { extractRemitaPurpose } from '../remitaReason';
import { extractNarrationReason } from '../classify';
import { describeGroupForSheet } from '../suggestReason';
import type { SourceGroup } from '../types';

const N = {
  salary: 'REMITA INFLOW R-1445788162/NIGERIAN U:STAFFSALARYFORMARCH2026:CBN:14457955/90144578 81620',
  qtr: 'REMITA INFLOW R-1450507303/NIGERIAN U:2NDQUARTERALLOWANCES2026TOSTAFF:CBN:/901450 5073030',
  annual: 'REMITA INFLOW R-1463090335/NIGERIAN U:ANNUALINTERVENTIONALLOWANCETONUPRCST/901 4630903350',
  burial: 'REMITA INFLOW R-1464021004/NIGERIAN U:EMPLOYEEFAMILYBURIALASSISTANCE:CBN:1/9014640 210040',
  bonus: 'REMITA INFLOW R-1506814400/NIGERIAN U:ENDOFNEGOTIATIONBONUS2026:CBN:150685/90150681 44000',
  oneoff: 'REMITA INFLOW R-1510509599/NIGERIAN U:2026ONEOFFPRODUCTIVITYRECOGNITIONALL/9015105 095990',
};

test('glued Remita purposes are split into words', () => {
  expect(extractRemitaPurpose(N.salary)).toBe('Staff salary for March 2026');
  expect(extractRemitaPurpose(N.qtr)).toBe('2nd quarter allowances 2026 to staff');
  expect(extractRemitaPurpose(N.annual)).toBe('Annual intervention allowance to NUPRC');
  expect(extractRemitaPurpose(N.burial)).toBe('Employee family burial assistance');
  expect(extractRemitaPurpose(N.bonus)).toBe('End of negotiation bonus 2026');
  expect(extractRemitaPurpose(N.oneoff)).toBe('2026 one off productivity recognition');
});
test('non-Remita narrations are untouched', () => {
  expect(extractRemitaPurpose('NIP/TUNDE BAKARE/rent')).toBeNull();
});
test('feeds the Reason column', () => {
  expect(extractNarrationReason(N.bonus, ['NIGERIAN'])).toBe('End of negotiation bonus 2026');
});
test('sheet summary puts Salary first, then Allowances, then the rest', () => {
  const t = (n: string) => ({ date: new Date(2026, 0, 1), narration: n, credit: 1, debit: 0, balance: 0 });
  const grp = { type: 'company', txns: [N.bonus, N.burial, N.qtr, N.salary].map(t) } as unknown as SourceGroup;
  expect(describeGroupForSheet(grp)).toBe('Salary, Allowances, Bonus, Burial assistance');
  const sal = { type: 'salary', txns: [t(N.salary)] } as unknown as SourceGroup;
  expect(describeGroupForSheet(sal)).toBe('Salary');
});

test('birthday shows as Gift (birthday); leftover wording is surfaced for review', () => {
  const t = (n: string) => ({ date: new Date(2026, 0, 1), narration: n, credit: 1, debit: 0, balance: 0 });
  const g = (type: string, n: string) => ({ type, name: 'Ladenika Adebowale', txns: [t(n)] } as unknown as SourceGroup);
  expect(describeGroupForSheet(g('personal', 'FROM GTBANK/ LADENIKA ADEBOWALE/HAPPY BIRTHDAY SIS'))).toBe('Gift (birthday)');
  expect(describeGroupForSheet(g('personal', 'NIP/LADENIKA ADEBOWALE/pls keep this for me'))).toMatch(/^Check: /);
});

import { buildIncomeSourceBreakdown } from '../classify';
test('all salary payments land in one Salary group; allowances stay with the employer', () => {
  const mk = (d: string, n: string, c: number) => ({ date: new Date(d), narration: n, credit: c, debit: 0, balance: 0 });
  const txns = [
    mk('2026-03-18', N.salary, 654071.67),
    mk('2026-03-31', N.qtr, 3786435),
    mk('2026-05-21', 'REMITA INFLOW R-1468069461/NIGERIAN U:MAY2026NUPRCSTAFFSALARY:CBN:14681127/90146806 94610', 648358.4),
    mk('2026-06-24', 'REMITA INFLOW R-1477854687/NIGERIAN U:STAFFSALARYFORJUNE2026:CBN:147836786/9014778546', 648358.4),
    mk('2026-08-29', N.bonus, 2155952.84),
  ] as any;
  const g = buildIncomeSourceBreakdown(txns, 'POPOOLA ADEPEJU ADETUTU', undefined, {}, { minInflow: 50000, dropReversals: true });
  const sal = g.find((x) => x.type === 'salary')!;
  expect(sal.count).toBe(3);
  const emp = g.find((x) => x.name === 'Nigerian')!;
  expect(emp.count).toBe(2);
  expect(emp.txns.some((t) => /SALARY/i.test(t.narration))).toBe(false);
});

import { buildActionPlan } from '../actionPlan';
describe('action plan', () => {
  const base = { openingBalance: 100000, closingBalance: 2000000, totalInflow: 5e6, totalOutflow: 3e6, recommendedFundsFloor: 1e6, hasSalaryIncome: true, hasOtherRecurringIncome: false, statementCurrencyIssues: [] as ('stale' | 'short_span')[], unexplainedGroupCount: 0 };
  test('healthy statement gets a short, positive do-list but still the standing do-nots', () => {
    const p = buildActionPlan(base);
    expect(p.doList.some((d) => /employment letter/i.test(d))).toBe(true);
    expect(p.dontList.length).toBeGreaterThanOrEqual(3);
    expect(p.easierList.length).toBeGreaterThan(2);
  });
  test('problems turn into plain actions', () => {
    const p = buildActionPlan({ ...base, closingBalance: 200000, unexplainedGroupCount: 2, statementCurrencyIssues: ['stale'], totalOutflow: 9e6 });
    const t = p.doList.join(' ');
    expect(t).toMatch(/fresh statement/);
    expect(t).toMatch(/2 still need/);
    expect(t).toMatch(/Build your balance/);
    expect(t).toMatch(/Spend less/);
  });
});
