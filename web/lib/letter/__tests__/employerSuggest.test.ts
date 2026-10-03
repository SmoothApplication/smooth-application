import { suggestEmployerNames, hasSalaryLikeIncome } from '../employerSuggest';
import { buildLetterPayload } from '../buildLetterPayload';
import { DEFAULT_ANSWERS } from '@/lib/checklist/types';
import { ParsedTxn, SourceGroups } from '@/lib/statement/types';

const t = (d: string, credit: number, narration: string): ParsedTxn => ({ date: new Date(d), credit, debit: 0, balance: 0, narration });

const salaryTxns = [
  t('2026-03-18', 654071, 'INFLOW R-1445788162/NIGERIAN U:STAFFSALARYFORMARCH2026:CBN'),
  t('2026-04-23', 654071, 'INFLOW R-1458479293/NIGERIAN U:STAFFSALARYFORAPRIL2026:CBN'),
  t('2026-05-21', 648358, 'NIGERIAN U:MAY2026NUPRCSTAFFSALARY:CBN:'),
];
const groups = [
  { name: 'Salary', type: 'salary', count: 3, total: 1956500, firstDate: salaryTxns[0].date, lastDate: salaryTxns[2].date, txns: salaryTxns },
] as unknown as SourceGroups;

describe('employer suggestions', () => {
  it('offers the Remita remitter as a one-tap employer name', () => {
    const s = suggestEmployerNames(groups);
    expect(s[0].name).toBe('Nigerian');
    expect(s[0].count).toBe(3);
    expect(hasSalaryLikeIncome(groups)).toBe(true);
  });
  it('letter tells the steady monthly income story with the employer', () => {
    const p = buildLetterPayload({
      countryName: 'United Kingdom', visaName: 'Standard Visitor visa', applicantName: 'A B',
      answers: { ...DEFAULT_ANSWERS, purpose: 'tourism' }, employed: true, selfEmployed: false,
      employerName: 'Nigerian Upstream Petroleum', businessName: '', groups, statementSummaries: [],
      totalInflow: 0, totalOutflow: 0, openingBalance: 0, closingBalance: 0, financialInputs: null,
    });
    expect(p.incomeParagraphs.join(' ')).toContain('from Nigerian Upstream Petroleum');
    expect(p.incomeParagraphs.join(' ')).toContain('3 separate months');
    expect(p.incomeParagraphs.join(' ')).toContain('sustainable monthly income');
  });
});
