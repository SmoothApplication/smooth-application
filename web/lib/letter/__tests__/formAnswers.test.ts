import { buildFormAnswers, monthlyNetSalary, averageMonthlySpend } from '../formAnswers';
import { buildLetterPayload } from '../buildLetterPayload';
import { renderLetterText } from '../renderLetterText';
import { DEFAULT_ANSWERS } from '@/lib/checklist/types';
import type { ParsedTxn, SourceGroups } from '@/lib/statement/types';

const t = (d: string, credit: number, debit: number, narration: string): ParsedTxn => ({ date: new Date(d), credit, debit, balance: 0, narration });
const salaryTxns = [
  t('2026-03-18', 654071.67, 0, 'NIGERIAN U:STAFFSALARYFORMARCH2026'),
  t('2026-04-23', 654071.67, 0, 'NIGERIAN U:STAFFSALARYFORAPRIL2026'),
  t('2026-05-21', 648358.4, 0, 'NIGERIAN U:MAY2026NUPRCSTAFFSALARY'),
  t('2026-06-24', 648358.4, 0, 'NIGERIAN U:STAFFSALARYFORJUNE2026'),
  t('2026-07-22', 648358.4, 0, 'NIGERIAN U:STAFFSALARYJULY2026'),
];
const groups = [{ name: 'Salary', type: 'salary', count: 5, total: 3253218.54, firstDate: salaryTxns[0].date, lastDate: salaryTxns[4].date, txns: salaryTxns }] as unknown as SourceGroups;
const txns = [...salaryTxns, t('2026-03-20', 0, 300000, 'POS'), t('2026-04-20', 0, 100000, 'POS')];

describe('form answers', () => {
  it('average salary credit and average monthly spend', () => {
    expect(Math.round(monthlyNetSalary(groups))).toBe(Math.round((654071.67*2 + 648358.4*3) / 5));
    expect(Math.round(averageMonthlySpend(txns))).toBe(Math.round(400000 / 5));
  });
  it('converts to pounds at the typed rate', () => {
    const a = buildFormAnswers({
      groups, txns, closingBalance: 2229805, otherSavingsTotal: 0, employed: true, selfEmployed: false, employerName: 'NUPRC',
      jobTitle: 'Senior Regulatory Officer', startedWhen: 'August 2025', jobDescription: 'HR admin', ratePerGbp: 597.4, plannedSpendNgn: 1500000,
      travelDate: '30 October 2026', returnDate: '8 November 2026',
    });
    const earn = a.find((x) => x.question.startsWith('How much do you earn'))!;
    const avg = (654071.67 * 2 + 648358.4 * 3) / 5;
    expect(earn.answer).toBe(`${(avg / 597.4).toFixed(2)} GBP (₦${Math.round(avg).toLocaleString('en-NG')})`);
    expect(a.find((x) => x.question === 'Your job title')!.answer).toBe('Senior Regulatory Officer');
  });
  it('lists salary, allowances and their total on separate lines', () => {
    const al = [t('2026-03-31', 5000000, 0, 'NIGERIAN U:HOUSING ALLOWANCE'), t('2026-04-30', 7000000, 0, 'NIGERIAN U:TRANSPORT ALLOWANCE')];
    const sTx = salaryTxns.map((x) => ({ ...x, narration: 'NIGERIAN U: STAFF SALARY' }));
    const g = [{ ...groups[0], txns: [...sTx, ...al] }] as unknown as SourceGroups;
    const a = buildFormAnswers({ groups: g, txns, closingBalance: 0, otherSavingsTotal: 0, employed: true, selfEmployed: false, employerName: '', jobTitle: '', startedWhen: '', jobDescription: '', ratePerGbp: 0, plannedSpendNgn: 0, travelDate: '', returnDate: '' });
    const sal = (654071.67 * 2 + 648358.4 * 3) / 5;
    expect(a.find((x) => x.question === 'Monthly salary - after tax')!.answer).toBe(`₦${Math.round(sal).toLocaleString('en-NG')}`);
    expect(a.find((x) => x.question.startsWith('Monthly allowances'))!.answer).toBe('₦6,000,000');
    expect(a.find((x) => x.question.includes('salary + allowances'))!.answer).toBe(`₦${Math.round(sal + 6000000).toLocaleString('en-NG')}`);
  });
  it('warns when a few large payments dominate the allowances', () => {
    const sTx = salaryTxns.map((x) => ({ ...x, narration: 'NIGERIAN U: STAFF SALARY' }));
    const big = [t('2026-05-04', 9500000, 0, 'NIGERIAN U:ARREARS'), t('2026-09-07', 10500000, 0, 'NIGERIAN U:ARREARS 2'), t('2026-06-25', 700000, 0, 'NIGERIAN U:TRANSPORT')];
    const g = [{ ...groups[0], txns: [...sTx, ...big] }] as unknown as SourceGroups;
    const a = buildFormAnswers({ groups: g, txns, closingBalance: 0, otherSavingsTotal: 0, employed: true, selfEmployed: false, employerName: '', jobTitle: '', startedWhen: '', jobDescription: '', ratePerGbp: 0, plannedSpendNgn: 0, travelDate: '', returnDate: '' });
    expect(a.find((x) => x.question.includes('salary + allowances'))!.note).toContain('Warning');
    const calm = [{ ...groups[0], txns: [...sTx, t('2026-05-04', 100000, 0, 'NIGERIAN U:TRANSPORT')] }] as unknown as SourceGroups;
    const b = buildFormAnswers({ groups: calm, txns, closingBalance: 0, otherSavingsTotal: 0, employed: true, selfEmployed: false, employerName: '', jobTitle: '', startedWhen: '', jobDescription: '', ratePerGbp: 0, plannedSpendNgn: 0, travelDate: '', returnDate: '' });
    expect(b.find((x) => x.question.includes('salary + allowances'))!.note).not.toContain('Warning');
  });
  it('reuses checklist answers and the salary note', () => {
    const a = buildFormAnswers({
      groups, txns, closingBalance: 1000000, otherSavingsTotal: 0, employed: true, selfEmployed: false, employerName: '', jobTitle: '', startedWhen: '', jobDescription: '',
      ratePerGbp: 0, plannedSpendNgn: 0, travelDate: '', returnDate: '', salaryNote: 'Grade level 12', maritalStatus: 'married', numKids: '2', agedParents: true, hasRefusal: false, hasHost: true,
    });
    const get = (q: string) => a.find((x) => x.question === q)?.answer;
    expect(get('Anything else about your pay')).toBe('Grade level 12');
    expect(get('What is your marital status?')).toBe('Married');
    expect(get('Do you financially support anyone at home?')).toBe('Yes - your parents and 2 children');
    expect(get('Have you ever been refused a visa?')).toBe('No');
    expect(get('Where will you stay?')).toContain('host');
  });
  it('puts the salary note into the letter', () => {
    const p = buildLetterPayload({
      countryName: 'United Kingdom', visaName: 'v', applicantName: 'A P', answers: { ...DEFAULT_ANSWERS, purpose: 'tourism' as const }, employed: true, selfEmployed: false,
      employerName: 'NUPRC', businessName: '', groups, statementSummaries: [], totalInflow: 0, totalOutflow: 0, openingBalance: 0, closingBalance: 0, financialInputs: null,
      salaryNote: 'I am on grade level 12',
    } as never);
    expect(JSON.stringify(p)).toContain('I am on grade level 12.');
  });
  it('naira only when no rate is given', () => {
    const a = buildFormAnswers({ groups, txns, closingBalance: 1000000, otherSavingsTotal: 0, employed: true, selfEmployed: false, employerName: '', jobTitle: '', startedWhen: '', jobDescription: '', ratePerGbp: 0, plannedSpendNgn: 0, travelDate: '', returnDate: '' });
    expect(a.find((x) => x.question.startsWith('How much money do you have'))!.answer).toBe('₦1,000,000');
  });
});

describe('letter with personal details', () => {
  const base = {
    countryName: 'United Kingdom', visaName: 'Standard Visitor visa', applicantName: 'A P',
    answers: { ...DEFAULT_ANSWERS, purpose: 'tourism' as const }, employed: true, selfEmployed: false,
    employerName: 'Nigerian Upstream Petroleum Regulatory Commission', businessName: '', groups, statementSummaries: [
      { label: 'Providus Bank', txnCount: 5, firstDate: new Date('2026-03-01'), lastDate: new Date('2026-09-01'), closingBalance: 4687534 },
    ],
    totalInflow: 0, totalOutflow: 0, openingBalance: 0, closingBalance: 4687534, financialInputs: null,
  };
  it('mentions the payslip and says it matches the salary credits', () => {
    const p = buildLetterPayload({ ...base, jobTitle: '', startedWhen: '', jobDescription: '', previousEmployment: '', plans: '', otherSavings: [], payslip: { month: 'September 2026', gross: 1077976.42, net: 648358.4 } } as never);
    expect(p.incomeParagraphs.join(' ')).toContain('My payslip for September 2026 shows gross monthly pay of');
  });
  it('uses job title, start, description, previous job, plans and other accounts', () => {
    const p = buildLetterPayload({
      ...base, jobTitle: 'Senior Regulatory Officer', startedWhen: 'August 2025', jobDescription: 'I handle HR administration',
      previousEmployment: 'I worked at Sterling Bank for 10 years', plans: 'I plan to see the London Eye',
      otherSavings: [{ bank: 'Zenith Bank', type: 'Savings', balance: 2092321 }],
    });
    expect(p.employmentParagraph).toContain('I am a Senior Regulatory Officer with Nigerian Upstream');
    expect(p.employmentParagraph).toContain('I joined Nigerian Upstream Petroleum Regulatory Commission in August 2025.');
    expect(p.employmentParagraph).toContain('Before that, I worked at Sterling Bank');
    expect(p.purposeParagraph).toContain('London Eye');
    expect(p.savingsRows).toHaveLength(2);
    expect(p.savingsTotal).toBe(4687534 + 2092321);
    expect(renderLetterText(p)).toContain('Total savings and investments: ₦6,779,855');
  });
});
