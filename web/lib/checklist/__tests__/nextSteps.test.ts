// Ported scenarios from index.html's renderNextStepsReport() (~line 7483-7592) and the
// balancePillEl/incomePillEl classification it reads via readinessStatusFromPill() (~8347-8423,
// 13502-13514) — reduced here to the FinancialResult-only proxy this port uses instead (see
// nextSteps.ts's header comment for what that proxy deliberately loses).

import {
  computeFinanceReadiness,
  computePassportSection,
  computeTravelHistorySection,
  computeFinanceSection,
  computeTimeToTravel,
  computeOverallVerdict,
  buildNextStepsReport,
  NextStepsInputs,
} from '../nextSteps';
import { DEFAULT_FINANCIAL_INPUTS, computeFinancials, FinancialResult, CF_MONTHS } from '../financial';
import { TravelHistoryRow, OverstayRow } from '../travelHistory';

function historyRow(country: string, overrides: Partial<TravelHistoryRow> = {}): TravelHistoryRow {
  return { country, date: '2024-05', reason: 'Holiday', days: '5', ...overrides };
}

function financialWith(overrides: Partial<Parameters<typeof computeFinancials>[0]> = {}): FinancialResult {
  return computeFinancials({ ...DEFAULT_FINANCIAL_INPUTS, ...overrides });
}

const STEADY_CASH_FLOW = Array.from({ length: CF_MONTHS }, (_, i) => ({
  month: `2024-0${i + 1}`,
  inflow: 200000,
  outflow: 50000,
  balance: '150000',
}));

// A financial result whose balance is comfortably ready (2x buffer covered).
function readyFinancial(): FinancialResult {
  return financialWith({
    costs: { flightPerAdult: 100000, accomPerNight: 10000, nights: 5, transport: 0, shopping: 0, sightseeing: 0 },
    funds: { closingBalance: 1000000, forexSavings: 0 },
  });
}

// A financial result with steady, gap-free cash flow (6 filled months, no zero-income months, low variance).
function steadyCashFlow(): FinancialResult {
  return financialWith({ cashFlow: STEADY_CASH_FLOW });
}

// Both balance and income looking complete at once — the "fully strong applicant" case.
function fullyStrongFinancial(): FinancialResult {
  return financialWith({
    costs: { flightPerAdult: 100000, accomPerNight: 10000, nights: 5, transport: 0, shopping: 0, sightseeing: 0 },
    funds: { closingBalance: 1000000, forexSavings: 0 },
    cashFlow: STEADY_CASH_FLOW,
  });
}

describe('computeFinanceReadiness', () => {
  test('missing when nothing entered', () => {
    const result = computeFinanceReadiness(financialWith());
    expect(result.balanceStatus).toBe('missing');
    expect(result.incomeStatus).toBe('missing');
  });

  test('balance looks_complete when funds cover the 2x buffer', () => {
    const result = computeFinanceReadiness(readyFinancial());
    expect(result.balanceStatus).toBe('looks_complete');
  });

  test('balance needs_review when funds entered but below the buffer', () => {
    const result = computeFinanceReadiness(
      financialWith({
        costs: { flightPerAdult: 500000, accomPerNight: 20000, nights: 5, transport: 0, shopping: 0, sightseeing: 0 },
        funds: { closingBalance: 100000, forexSavings: 0 },
      })
    );
    expect(result.balanceStatus).toBe('needs_review');
  });

  test('balance needs_review when funds entered but no trip cost to compare against', () => {
    const result = computeFinanceReadiness(financialWith({ funds: { closingBalance: 500000, forexSavings: 0 } }));
    expect(result.balanceStatus).toBe('needs_review');
  });

  test('income looks_complete with steady, gap-free cash flow', () => {
    const result = computeFinanceReadiness(steadyCashFlow());
    expect(result.incomeStatus).toBe('looks_complete');
  });

  test('income needs_review with a zero-income month', () => {
    const cashFlow = Array.from({ length: CF_MONTHS }, (_, i) => ({
      month: `2024-0${i + 1}`,
      inflow: i === 0 ? 0 : 200000,
      outflow: 50000,
      balance: '150000',
    }));
    const result = computeFinanceReadiness(financialWith({ cashFlow }));
    expect(result.incomeStatus).toBe('needs_review');
  });

  test('income needs_review with high month-to-month variance', () => {
    const cashFlow = [
      { month: '2024-01', inflow: 50000, outflow: 10000, balance: '' },
      { month: '2024-02', inflow: 900000, outflow: 10000, balance: '' },
    ];
    const result = computeFinanceReadiness(financialWith({ cashFlow }));
    expect(result.incomeStatus).toBe('needs_review');
  });
});

describe('computePassportSection', () => {
  test('null / info when nothing entered', () => {
    const { passportOk, section } = computePassportSection('', '', 'Standard Visitor visa');
    expect(passportOk).toBeNull();
    expect(section.status).toBe('info');
  });

  test('null / info when the expiry date is unparseable', () => {
    const { passportOk, section } = computePassportSection('not-a-date', '', 'Standard Visitor visa');
    expect(passportOk).toBeNull();
    expect(section.status).toBe('info');
  });

  test('ok when expiry clears 6 months beyond the travel date', () => {
    const { passportOk, section } = computePassportSection('2027-06-01', '2026-11-01', 'Standard Visitor visa');
    expect(passportOk).toBe(true);
    expect(section.status).toBe('ok');
  });

  test('warn when expiry falls short of 6 months beyond the travel date', () => {
    const { passportOk, section } = computePassportSection('2027-01-01', '2026-11-01', 'Standard Visitor visa');
    expect(passportOk).toBe(false);
    expect(section.status).toBe('warn');
  });

  test('falls back to today as the reference date when no travel date is entered', () => {
    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 5);
    const { passportOk } = computePassportSection(farFuture.toISOString().slice(0, 10), '', 'Standard Visitor visa');
    expect(passportOk).toBe(true);
  });
});

describe('computeTravelHistorySection', () => {
  test('info when not answered yet', () => {
    const section = computeTravelHistorySection('', [], [], false, 'Standard Visitor visa');
    expect(section.status).toBe('info');
  });

  test('warn (easier destinations) when answered but no rows and finances are not strong', () => {
    const section = computeTravelHistorySection('no', [], [], false, 'Standard Visitor visa');
    expect(section.status).toBe('warn');
    expect(section.message).toContain('Ghana, Kenya, Ethiopia, or Morocco');
  });

  test('warn (South Africa suggestion) when answered but no rows and finances ARE strong', () => {
    const section = computeTravelHistorySection('no', [], [], true, 'Standard Visitor visa');
    expect(section.status).toBe('warn');
    expect(section.message).toContain('South Africa');
  });

  test('ok when history exists with no overstay', () => {
    const section = computeTravelHistorySection('yes', [historyRow('France')], [], false, 'Standard Visitor visa');
    expect(section.status).toBe('ok');
  });

  test('ok message calls out a high-success country when present', () => {
    const section = computeTravelHistorySection('yes', [historyRow('Morocco')], [], false, 'Standard Visitor visa');
    expect(section.message).toContain('South Africa, Morocco, and/or Kenya');
  });

  test('warn when an overstay is on record, even with history present', () => {
    const overstay: OverstayRow[] = [{ country: 'Morocco', days: '15' }];
    const section = computeTravelHistorySection('yes', [historyRow('Morocco')], overstay, false, 'Standard Visitor visa');
    expect(section.status).toBe('warn');
    expect(section.message).toContain('overstay is on record');
  });
});

describe('computeFinanceSection', () => {
  test('info when neither balance nor income has any data', () => {
    const { section, financeEntered, financeStrong } = computeFinanceSection(
      { balanceStatus: 'missing', incomeStatus: 'missing' },
      'UKVI',
      '6 months'
    );
    expect(section.status).toBe('info');
    expect(financeEntered).toBe(false);
    expect(financeStrong).toBe(false);
  });

  test('ok when both balance and income look complete', () => {
    const { section, financeStrong } = computeFinanceSection(
      { balanceStatus: 'looks_complete', incomeStatus: 'looks_complete' },
      'UKVI',
      '6 months'
    );
    expect(section.status).toBe('ok');
    expect(financeStrong).toBe(true);
  });

  test('warn listing both gaps when neither looks complete but something was entered', () => {
    const { section } = computeFinanceSection(
      { balanceStatus: 'needs_review', incomeStatus: 'needs_review' },
      'UKVI',
      '6 months'
    );
    expect(section.status).toBe('warn');
    expect(section.message).toContain('build up your closing balance');
    expect(section.message).toContain('make your income more consistent');
  });

  test('warn listing only the income gap when balance already looks complete', () => {
    const { section } = computeFinanceSection(
      { balanceStatus: 'looks_complete', incomeStatus: 'needs_review' },
      'UKVI',
      '6 months'
    );
    expect(section.message).not.toContain('closing balance');
    expect(section.message).toContain('income');
  });
});

describe('computeTimeToTravel', () => {
  test('null when there is no travel date', () => {
    expect(computeTimeToTravel('', null, false, false)).toBeNull();
  });

  test('null when the travel date is more than 100 days out', () => {
    const farDate = new Date();
    farDate.setDate(farDate.getDate() + 200);
    expect(computeTimeToTravel(farDate.toISOString().slice(0, 10), null, false, false)).toBeNull();
  });

  test('null when the travel date is in the past', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    expect(computeTimeToTravel(pastDate.toISOString().slice(0, 10), null, false, false)).toBeNull();
  });

  test('lists priorities in order: passport, history, finance', () => {
    const soonDate = new Date();
    soonDate.setDate(soonDate.getDate() + 30);
    const breakdown = computeTimeToTravel(soonDate.toISOString().slice(0, 10), false, false, false);
    expect(breakdown?.priorities).toEqual([
      'Renew your passport first - it blocks everything else on this list.',
      'Consider an easier destination now to start building travel history, if time allows.',
      'Focus on strengthening your finances - closing balance and income consistency.',
    ]);
  });

  test('empty priorities when everything is already on track', () => {
    const soonDate = new Date();
    soonDate.setDate(soonDate.getDate() + 30);
    const breakdown = computeTimeToTravel(soonDate.toISOString().slice(0, 10), true, true, true);
    expect(breakdown?.priorities).toEqual([]);
  });
});

describe('computeOverallVerdict', () => {
  test('ok when passport clears and finances are strong', () => {
    expect(computeOverallVerdict(true, true, true).status).toBe('ok');
  });

  test('info when nothing has been entered at all', () => {
    expect(computeOverallVerdict(null, false, false).status).toBe('info');
  });

  test('warn otherwise', () => {
    expect(computeOverallVerdict(false, true, false).status).toBe('warn');
    expect(computeOverallVerdict(true, true, false).status).toBe('warn');
  });
});

describe('buildNextStepsReport (integration)', () => {
  function baseInputs(overrides: Partial<NextStepsInputs> = {}): NextStepsInputs {
    return {
      visaShortLabel: 'Standard Visitor visa',
      authority: 'UKVI',
      statementsMonthsText: '6 months',
      passportExpiry: '',
      travelDate: '',
      firstTimeAnswer: '',
      historyRows: [],
      overstayRows: [],
      financial: financialWith(),
      ...overrides,
    };
  }

  test('a completely empty applicant gets all-info sections and an info overall verdict', () => {
    const report = buildNextStepsReport(baseInputs());
    expect(report.passport.status).toBe('info');
    expect(report.travelHistory.status).toBe('info');
    expect(report.finance.status).toBe('info');
    expect(report.timeToTravel).toBeNull();
    expect(report.overall.status).toBe('info');
  });

  test('a fully strong applicant gets an ok overall verdict', () => {
    const report = buildNextStepsReport(
      baseInputs({
        passportExpiry: (() => {
          const d = new Date();
          d.setFullYear(d.getFullYear() + 3);
          return d.toISOString().slice(0, 10);
        })(),
        firstTimeAnswer: 'yes',
        historyRows: [historyRow('Ghana')],
        financial: fullyStrongFinancial(),
      })
    );
    expect(report.passport.status).toBe('ok');
    expect(report.travelHistory.status).toBe('ok');
    expect(report.finance.status).toBe('ok');
    expect(report.overall.status).toBe('ok');
  });

  test('mixed results produce a warn overall verdict, not ok or info', () => {
    const report = buildNextStepsReport(
      baseInputs({
        passportExpiry: (() => {
          const d = new Date();
          d.setFullYear(d.getFullYear() + 3);
          return d.toISOString().slice(0, 10);
        })(),
        firstTimeAnswer: 'no',
      })
    );
    expect(report.passport.status).toBe('ok');
    expect(report.travelHistory.status).toBe('warn');
    expect(report.overall.status).toBe('warn');
  });
});
