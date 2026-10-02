import { checkLetterSufficiency } from '../sufficiency';
import { LetterInput } from '../types';
import { DEFAULT_ANSWERS } from '@/lib/checklist/types';
import { DEFAULT_FINANCIAL_INPUTS } from '@/lib/checklist/financial';
import { SourceGroups } from '@/lib/statement/types';

function baseInput(overrides: Partial<LetterInput> = {}): LetterInput {
  return {
    countryName: 'United Kingdom',
    visaName: 'Standard Visitor visa',
    applicantName: 'Jane Doe',
    answers: {
      ...DEFAULT_ANSWERS,
      purpose: 'tourism',
      livingState: 'Lagos',
      livingLga: 'Eti Osa',
    },
    employed: true,
    selfEmployed: false,
    employerName: 'Acme Ltd',
    businessName: '',
    groups: [
      {
        name: 'Salary',
        type: 'salary',
        count: 3,
        total: 900000,
        firstDate: new Date('2026-01-01'),
        lastDate: new Date('2026-03-01'),
        txns: [],
      },
    ] as SourceGroups,
    statementSummaries: [{ label: 'Statement 1', txnCount: 10, firstDate: new Date('2026-01-01'), lastDate: new Date('2026-06-01'), closingBalance: 500000 }],
    totalInflow: 900000,
    totalOutflow: 400000,
    openingBalance: 100000,
    closingBalance: 500000,
    financialInputs: { ...DEFAULT_FINANCIAL_INPUTS, travelDate: '2026-10-30', returnDate: '2026-11-08' },
    ...overrides,
  };
}

describe('checkLetterSufficiency', () => {
  it('is sufficient when every required piece is present', () => {
    const result = checkLetterSufficiency(baseInput());
    expect(result.sufficient).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('flags a missing applicant name', () => {
    const result = checkLetterSufficiency(baseInput({ applicantName: '' }));
    expect(result.sufficient).toBe(false);
    expect(result.missing.some((m) => /full name/i.test(m))).toBe(true);
  });

  it('flags missing employment status', () => {
    const result = checkLetterSufficiency(baseInput({ employed: false, selfEmployed: false }));
    expect(result.missing.some((m) => /employment status/i.test(m))).toBe(true);
  });

  it('flags an employed applicant with no employer name entered', () => {
    const result = checkLetterSufficiency(baseInput({ employerName: '' }));
    expect(result.missing.some((m) => /employer/i.test(m))).toBe(true);
  });

  it('flags a self-employed applicant with no business name entered', () => {
    const result = checkLetterSufficiency(
      baseInput({ employed: false, selfEmployed: true, employerName: '', businessName: '' })
    );
    expect(result.missing.some((m) => /business name/i.test(m))).toBe(true);
  });

  it('flags no bank statement uploaded', () => {
    const result = checkLetterSufficiency(baseInput({ statementSummaries: [] }));
    expect(result.missing.some((m) => /bank statement with transactions/i.test(m))).toBe(true);
  });

  it('flags no recognisable income source', () => {
    const result = checkLetterSufficiency(baseInput({ groups: [] as SourceGroups }));
    expect(result.missing.some((m) => /recognisable income source/i.test(m))).toBe(true);
  });

  it('flags a non-positive closing balance', () => {
    const result = checkLetterSufficiency(baseInput({ closingBalance: 0 }));
    expect(result.missing.some((m) => /positive closing balance/i.test(m))).toBe(true);
  });

  it('flags a missing purpose of visit', () => {
    const result = checkLetterSufficiency(baseInput({ answers: { ...DEFAULT_ANSWERS, livingState: 'Lagos' } }));
    expect(result.missing.some((m) => /purpose of visit/i.test(m))).toBe(true);
  });

  it('flags missing travel dates', () => {
    const result = checkLetterSufficiency(baseInput({ financialInputs: { ...DEFAULT_FINANCIAL_INPUTS } }));
    expect(result.missing.some((m) => /travel dates/i.test(m))).toBe(true);
  });

  it('flags a missing home address', () => {
    const result = checkLetterSufficiency(
      baseInput({ answers: { ...DEFAULT_ANSWERS, purpose: 'tourism', livingState: '' } })
    );
    expect(result.missing.some((m) => /home address/i.test(m))).toBe(true);
  });
});
