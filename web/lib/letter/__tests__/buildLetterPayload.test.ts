import { buildLetterPayload } from '../buildLetterPayload';
import { renderLetterText } from '../renderLetterText';
import { LetterInput } from '../types';
import { DEFAULT_ANSWERS } from '@/lib/checklist/types';
import { DEFAULT_FINANCIAL_INPUTS } from '@/lib/checklist/financial';
import { ParsedTxn, SourceGroups } from '@/lib/statement/types';

function txn(dateISO: string, credit: number): ParsedTxn {
  return { date: new Date(dateISO), credit, debit: 0, balance: 0, narration: 'x' };
}

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
      addressNumber: '12',
      addressName: 'Example Street',
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
        txns: [txn('2026-01-01', 300000), txn('2026-02-01', 300000), txn('2026-03-01', 300000)],
      },
      {
        name: 'Acme Ltd Bonus',
        type: 'company',
        count: 1,
        total: 150000,
        firstDate: new Date('2026-02-15'),
        lastDate: new Date('2026-02-15'),
        txns: [txn('2026-02-15', 150000)],
      },
    ] as SourceGroups,
    statementSummaries: [
      { label: 'Statement 1', txnCount: 10, firstDate: new Date('2026-01-01'), lastDate: new Date('2026-06-01'), closingBalance: 500000 },
    ],
    totalInflow: 1050000,
    totalOutflow: 400000,
    openingBalance: 100000,
    closingBalance: 500000,
    financialInputs: { ...DEFAULT_FINANCIAL_INPUTS, travelDate: '2026-10-30', returnDate: '2026-11-08' },
    ...overrides,
  };
}

describe('buildLetterPayload', () => {
  it('builds an employment paragraph mentioning the employer', () => {
    const payload = buildLetterPayload(baseInput());
    expect(payload.employmentParagraph).toMatch(/Acme Ltd/);
  });

  it('builds a self-employed paragraph mentioning the business name instead', () => {
    const payload = buildLetterPayload(
      baseInput({ employed: false, selfEmployed: true, employerName: '', businessName: 'Jane Trading Co' })
    );
    expect(payload.employmentParagraph).toMatch(/Jane Trading Co/);
    expect(payload.employmentParagraph).not.toMatch(/Acme/);
  });

  it('describes the salary group with its average and count', () => {
    const payload = buildLetterPayload(baseInput());
    expect(payload.incomeParagraphs.join(' ')).toMatch(/regular monthly salary/);
    expect(payload.incomeParagraphs.join(' ')).toMatch(/3 times/);
  });

  it('itemizes non-salary named income groups as rows, not the salary group', () => {
    const payload = buildLetterPayload(baseInput());
    expect(payload.incomeRows).toHaveLength(1);
    expect(payload.incomeRows[0].label).toBe('Acme Ltd Bonus');
    expect(payload.incomeRows[0].amount).toBe(150000);
  });

  it('excludes self/reversal/interest/internal/other groups from the itemized income rows', () => {
    const payload = buildLetterPayload(
      baseInput({
        groups: [
          { name: 'Self', type: 'self', count: 2, total: 50000, firstDate: new Date('2026-01-01'), lastDate: new Date('2026-02-01'), txns: [txn('2026-01-01', 25000)] },
          { name: 'Interest', type: 'interest', count: 1, total: 500, firstDate: new Date('2026-01-01'), lastDate: new Date('2026-01-01'), txns: [txn('2026-01-01', 500)] },
        ] as SourceGroups,
      })
    );
    expect(payload.incomeRows).toHaveLength(0);
  });

  it('caps the itemized income rows and notes the overflow', () => {
    const manyTxns = Array.from({ length: 20 }, (_, i) => txn(`2026-01-${String(i + 1).padStart(2, '0')}`, 10000));
    const payload = buildLetterPayload(
      baseInput({
        groups: [
          { name: 'Frequent Sender', type: 'personal', count: 20, total: 200000, firstDate: new Date('2026-01-01'), lastDate: new Date('2026-01-20'), txns: manyTxns },
        ] as SourceGroups,
      })
    );
    expect(payload.incomeRows).toHaveLength(14);
    expect(payload.incomeParagraphs.join(' ')).toMatch(/most recent 14 of 20/);
  });

  it('states the combined closing balance and total credits/debits in the savings paragraph', () => {
    const payload = buildLetterPayload(baseInput());
    expect(payload.savingsParagraph).toMatch(/₦500,000/);
    expect(payload.savingsParagraph).toMatch(/₦1,050,000/);
  });

  it('includes travel dates in the purpose paragraph when present', () => {
    const payload = buildLetterPayload(baseInput());
    expect(payload.purposeParagraph).toMatch(/30 October 2026/);
    expect(payload.purposeParagraph).toMatch(/8 November 2026/);
  });

  it('mentions the home address and employer in the ties paragraph', () => {
    const payload = buildLetterPayload(baseInput());
    expect(payload.tiesParagraph).toMatch(/Example Street/);
    expect(payload.tiesParagraph).toMatch(/Acme Ltd/);
  });

  it('renders to plain text containing all 5 numbered sections', () => {
    const payload = buildLetterPayload(baseInput());
    const text = renderLetterText(payload);
    expect(text).toMatch(/1\. Employment/);
    expect(text).toMatch(/2\. Income/);
    expect(text).toMatch(/3\. Savings and investments/);
    expect(text).toMatch(/4\. Purpose and plan of visit/);
    expect(text).toMatch(/5\. Ties to Nigeria/);
    expect(text).toMatch(/Enclosures:/);
  });

  it('uses the Entry Clearance Officer salutation for the UK and a generic one elsewhere', () => {
    const ukText = renderLetterText(buildLetterPayload(baseInput()));
    expect(ukText).toMatch(/Entry Clearance Officer/);

    const ghText = renderLetterText(buildLetterPayload(baseInput({ countryName: 'Ghana' })));
    expect(ghText).toMatch(/The Visa Officer/);
    expect(ghText).not.toMatch(/Entry Clearance Officer/);
  });
});
