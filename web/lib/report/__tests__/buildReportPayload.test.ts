import { DEFAULT_ANSWERS, Answers, ChecklistItem } from '@/lib/checklist/uk';
import { DEFAULT_FINANCIAL_INPUTS, FinancialInputs } from '@/lib/checklist/financial';
import { StatementSummary } from '@/lib/statement/combined';
import {
  buildResponsibilitiesSummary,
  buildDocsSummary,
  buildFinancialSummary,
  buildStatementSummary,
  buildReportPayload,
} from '../buildReportPayload';

const CHECKLIST: ChecklistItem[] = [
  { id: 'a', cat: 'Cat 1', label: 'Item A', weight: 'required' },
  { id: 'b', cat: 'Cat 1', label: 'Item B', weight: 'required' },
  { id: 'c', cat: 'Cat 2', label: 'Item C', weight: 'recommended' },
  { id: 'd', cat: 'Cat 2', label: 'Item D', weight: 'required', appliesIf: (a) => a.married },
];

describe('buildResponsibilitiesSummary', () => {
  it('returns only the previous-refusal line for an all-default Answers', () => {
    const lines = buildResponsibilitiesSummary(DEFAULT_ANSWERS);
    // hasRefusal is stated either way; everything else is empty/false and should be skipped
    expect(lines).toEqual([{ label: 'Previous visa refusal', value: 'No' }]);
  });

  it('includes employment/marital/spouse fields only when meaningful', () => {
    const a: Answers = {
      ...DEFAULT_ANSWERS,
      employed: true,
      maritalStatus: 'married',
      married: true,
      spouseSponsoring: true,
      spouseName: 'Jane Doe',
    };
    const lines = buildResponsibilitiesSummary(a);
    expect(lines).toContainEqual({ label: 'Employed', value: 'Yes' });
    expect(lines).toContainEqual({ label: 'Marital status', value: 'Married' });
    expect(lines).toContainEqual({ label: 'Spouse sponsoring the trip', value: 'Yes' });
    expect(lines).toContainEqual({ label: 'Spouse name', value: 'Jane Doe' });
  });

  it('does not include spouse name when not married', () => {
    const lines = buildResponsibilitiesSummary({ ...DEFAULT_ANSWERS, spouseName: 'Jane Doe' });
    expect(lines.find((l) => l.label === 'Spouse name')).toBeUndefined();
  });

  it('skips a deceased parent name even when agedParents is true', () => {
    const a: Answers = {
      ...DEFAULT_ANSWERS,
      agedParents: true,
      fatherName: 'John',
      fatherDeceased: true,
      motherName: 'Mary',
      motherDeceased: false,
    };
    const lines = buildResponsibilitiesSummary(a);
    expect(lines.find((l) => l.label === "Father's name")).toBeUndefined();
    expect(lines).toContainEqual({ label: "Mother's name", value: 'Mary' });
  });
});

describe('buildDocsSummary', () => {
  it('counts only applicable required items', () => {
    const checked = { a: true };
    const summary = buildDocsSummary(CHECKLIST, DEFAULT_ANSWERS, checked);
    // required+applicable for unmarried DEFAULT_ANSWERS: a, b (d doesn't apply)
    expect(summary.totalRequired).toBe(2);
    expect(summary.totalChecked).toBe(1);
    expect(summary.percent).toBe(50);
    expect(summary.missing).toEqual([{ id: 'b', label: 'Item B' }]);
  });

  it('includes the conditional required item once it applies', () => {
    const a: Answers = { ...DEFAULT_ANSWERS, married: true };
    const summary = buildDocsSummary(CHECKLIST, a, { a: true, b: true, d: true });
    expect(summary.totalRequired).toBe(3);
    expect(summary.totalChecked).toBe(3);
    expect(summary.percent).toBe(100);
    expect(summary.statusLabel).toBe('All required documents ready');
  });
});

describe('buildFinancialSummary', () => {
  it('returns null when nothing has been entered', () => {
    expect(buildFinancialSummary(DEFAULT_FINANCIAL_INPUTS)).toBeNull();
    expect(buildFinancialSummary(null)).toBeNull();
  });

  it('returns a populated summary once costs are entered', () => {
    const inputs: FinancialInputs = {
      ...DEFAULT_FINANCIAL_INPUTS,
      costs: { ...DEFAULT_FINANCIAL_INPUTS.costs, flightPerAdult: 500000, accomPerNight: 20000, nights: 5 },
      funds: { closingBalance: 2000000, forexSavings: 0 },
    };
    const summary = buildFinancialSummary(inputs);
    expect(summary).not.toBeNull();
    expect(summary!.totalCost).toBeGreaterThan(0);
    expect(summary!.fundsReady).toBe(true);
  });
});

describe('buildStatementSummary', () => {
  const s1: StatementSummary = {
    label: 'Salary account',
    txnCount: 3,
    firstDate: new Date('2026-01-01'),
    lastDate: new Date('2026-03-01'),
    closingBalance: 500000,
  };
  const empty: StatementSummary = { label: 'Statement 2', txnCount: 0, firstDate: null, lastDate: null, closingBalance: 0 };

  it('returns null when no statement has any transactions', () => {
    expect(buildStatementSummary([empty])).toBeNull();
    expect(buildStatementSummary([])).toBeNull();
  });

  it('excludes empty slots and combines the rest', () => {
    const s2: StatementSummary = {
      label: 'Side business',
      txnCount: 2,
      firstDate: new Date('2026-02-01'),
      lastDate: new Date('2026-02-20'),
      closingBalance: 250000,
    };
    const summary = buildStatementSummary([s1, empty, s2]);
    expect(summary).not.toBeNull();
    expect(summary!.statements).toHaveLength(2);
    expect(summary!.combinedClosingBalance).toBe(750000);
    expect(summary!.earliestDateISO).toBe(new Date('2026-01-01').toISOString());
    expect(summary!.latestDateISO).toBe(new Date('2026-03-01').toISOString());
  });
});

describe('buildReportPayload', () => {
  it('assembles all four sections consistently', () => {
    const payload = buildReportPayload({
      countryCode: 'uk',
      countryName: 'United Kingdom',
      visaName: 'Standard Visitor visa',
      checklist: CHECKLIST,
      answers: DEFAULT_ANSWERS,
      checked: { a: true },
      financialInputs: null,
      statementSummaries: [],
    });
    expect(payload.countryCode).toBe('uk');
    expect(payload.docs.totalRequired).toBe(2);
    expect(payload.financial).toBeNull();
    expect(payload.statement).toBeNull();
    expect(payload.responsibilities).toEqual([{ label: 'Previous visa refusal', value: 'No' }]);
    expect(typeof payload.generatedAtISO).toBe('string');
  });
});
