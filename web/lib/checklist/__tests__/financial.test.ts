import {
  computeFinancials,
  fmtN,
  emptyCashFlow,
  DEFAULT_FINANCIAL_INPUTS,
  FinancialInputs,
  CF_MONTHS,
} from '../financial';

function inputs(overrides: Partial<FinancialInputs> = {}): FinancialInputs {
  return { ...DEFAULT_FINANCIAL_INPUTS, ...overrides };
}

describe('fmtN', () => {
  it('formats with naira sign and thousands separators', () => {
    expect(fmtN(1234567)).toBe('₦1,234,567');
  });
  it('rounds fractional values', () => {
    expect(fmtN(999.6)).toBe('₦1,000');
  });
  it('handles negative values', () => {
    expect(fmtN(-500)).toBe('-₦500');
  });
  it('treats NaN/undefined as 0', () => {
    expect(fmtN(NaN)).toBe('₦0');
  });
});

describe('emptyCashFlow', () => {
  it('returns CF_MONTHS empty rows', () => {
    const rows = emptyCashFlow();
    expect(rows).toHaveLength(CF_MONTHS);
    expect(rows.every((r) => r.month === '' && r.inflow === 0 && r.outflow === 0 && r.balance === '')).toBe(true);
  });
});

describe('computeFinancials — trip cost & funds', () => {
  it('computes total cost as flight + accommodation + transport + shopping + sightseeing for a single adult', () => {
    const result = computeFinancials(
      inputs({
        travellers: { adults: 1, adolescents: 0, children: 0 },
        costs: { flightPerAdult: 500000, accomPerNight: 30000, nights: 5, transport: 50000, shopping: 20000, sightseeing: 10000 },
      })
    );
    expect(result.totalFlight).toBe(500000);
    expect(result.totalAccom).toBe(150000);
    expect(result.totalCost).toBe(500000 + 150000 + 50000 + 20000 + 10000);
  });

  it('discounts flight cost 10% for adolescents and 25% for children', () => {
    const result = computeFinancials(
      inputs({
        travellers: { adults: 1, adolescents: 1, children: 1 },
        costs: { flightPerAdult: 100000, accomPerNight: 0, nights: 0, transport: 0, shopping: 0, sightseeing: 0 },
      })
    );
    // 1 adult full fare + 1 adolescent at 90% + 1 child at 75%
    expect(result.totalFlight).toBe(Math.round(100000 * 1 + 100000 * 0.9 + 100000 * 0.75));
    expect(result.travellers).toBe(3);
  });

  it('defaults to 1 adult when no travellers are specified at all', () => {
    const result = computeFinancials(inputs({ travellers: { adults: 0, adolescents: 0, children: 0 } }));
    expect(result.travellers).toBe(1);
  });

  it('recommends 2x total cost as the funds buffer', () => {
    const result = computeFinancials(
      inputs({ costs: { flightPerAdult: 200000, accomPerNight: 0, nights: 0, transport: 0, shopping: 0, sightseeing: 0 } })
    );
    expect(result.recommendedFunds).toBe(result.totalCost * 2);
  });

  it('flags fundsReady true only when totalFunds covers the 2x buffer and cost is nonzero', () => {
    const underfunded = computeFinancials(
      inputs({
        costs: { flightPerAdult: 1000000, accomPerNight: 0, nights: 0, transport: 0, shopping: 0, sightseeing: 0 },
        funds: { closingBalance: 500000, forexSavings: 0 },
      })
    );
    expect(underfunded.fundsReady).toBe(false);
    expect(underfunded.shortfall).toBeGreaterThan(0);

    const wellFunded = computeFinancials(
      inputs({
        costs: { flightPerAdult: 500000, accomPerNight: 0, nights: 0, transport: 0, shopping: 0, sightseeing: 0 },
        funds: { closingBalance: 2000000, forexSavings: 0 },
      })
    );
    expect(wellFunded.fundsReady).toBe(true);
    expect(wellFunded.shortfall).toBeLessThanOrEqual(0);
  });

  it('is not fundsReady when totalCost is 0, even with funds present (matches index.html rule)', () => {
    const result = computeFinancials(inputs({ funds: { closingBalance: 1000000, forexSavings: 0 } }));
    expect(result.totalCost).toBe(0);
    expect(result.fundsReady).toBe(false);
  });
});

describe('computeFinancials — cash flow / income stability', () => {
  it('requires at least 2 filled months before trusting the average (hasCashFlowData)', () => {
    const oneRow = computeFinancials(
      inputs({
        cashFlow: [
          { month: 'Jan', inflow: 100000, outflow: 50000, balance: '' },
          ...emptyCashFlow().slice(1),
        ],
      })
    );
    expect(oneRow.hasCashFlowData).toBe(false);
    expect(oneRow.avgIn).toBe(0);

    const twoRows = computeFinancials(
      inputs({
        cashFlow: [
          { month: 'Jan', inflow: 100000, outflow: 50000, balance: '' },
          { month: 'Feb', inflow: 120000, outflow: 60000, balance: '' },
          ...emptyCashFlow().slice(2),
        ],
      })
    );
    expect(twoRows.hasCashFlowData).toBe(true);
    expect(twoRows.avgIn).toBe(110000);
    expect(twoRows.avgOut).toBe(55000);
    expect(twoRows.monthlyNetSavings).toBe(55000);
  });

  it('counts zero/negative-inflow months', () => {
    const result = computeFinancials(
      inputs({
        cashFlow: [
          { month: 'Jan', inflow: 0, outflow: 20000, balance: '' },
          { month: 'Feb', inflow: 100000, outflow: 20000, balance: '' },
          { month: 'Mar', inflow: 0, outflow: 15000, balance: '' },
          ...emptyCashFlow().slice(3),
        ],
      })
    );
    expect(result.zeroIncomeMonths).toBe(2);
  });

  it('computes a coefficient of variation of 0 for perfectly steady income', () => {
    const result = computeFinancials(
      inputs({
        cashFlow: [
          { month: 'Jan', inflow: 100000, outflow: 0, balance: '' },
          { month: 'Feb', inflow: 100000, outflow: 0, balance: '' },
          { month: 'Mar', inflow: 100000, outflow: 0, balance: '' },
          ...emptyCashFlow().slice(3),
        ],
      })
    );
    expect(result.incomeStabilityCv).toBe(0);
  });

  it('computes a positive coefficient of variation for volatile income', () => {
    const result = computeFinancials(
      inputs({
        cashFlow: [
          { month: 'Jan', inflow: 20000, outflow: 0, balance: '' },
          { month: 'Feb', inflow: 200000, outflow: 0, balance: '' },
          ...emptyCashFlow().slice(2),
        ],
      })
    );
    expect(result.incomeStabilityCv).toBeGreaterThan(0);
  });
});

describe('computeFinancials — timing', () => {
  it('leaves daysToPrep/daysToTravelAfterApp null when dates are blank', () => {
    const result = computeFinancials(inputs());
    expect(result.daysToPrep).toBeNull();
    expect(result.daysToTravelAfterApp).toBeNull();
  });

  it('computes daysToTravelAfterApp as the gap between appDate and travelDate', () => {
    const result = computeFinancials(inputs({ appDate: '2026-01-01', travelDate: '2026-01-15' }));
    expect(result.daysToTravelAfterApp).toBe(14);
  });

  it('produces no timingRealityCheck when there is no shortfall', () => {
    const result = computeFinancials(
      inputs({
        costs: { flightPerAdult: 100000, accomPerNight: 0, nights: 0, transport: 0, shopping: 0, sightseeing: 0 },
        funds: { closingBalance: 5000000, forexSavings: 0 },
      })
    );
    expect(result.shortfall).toBeLessThanOrEqual(0);
    expect(result.timingRealityCheck).toBe('');
    expect(result.monthsToCloseGap).toBeNull();
  });

  it('produces a timingRealityCheck when the savings pace cannot close the gap before appDate', () => {
    const todayPlus5 = new Date();
    todayPlus5.setHours(0, 0, 0, 0);
    todayPlus5.setDate(todayPlus5.getDate() + 5);
    const appDate = todayPlus5.toISOString().slice(0, 10);

    const result = computeFinancials(
      inputs({
        costs: { flightPerAdult: 2000000, accomPerNight: 0, nights: 0, transport: 0, shopping: 0, sightseeing: 0 },
        funds: { closingBalance: 0, forexSavings: 0 },
        cashFlow: [
          { month: 'Jan', inflow: 50000, outflow: 40000, balance: '' }, // net savings 10,000/mo — far too slow
          { month: 'Feb', inflow: 50000, outflow: 40000, balance: '' },
          ...emptyCashFlow().slice(2),
        ],
        appDate,
      })
    );
    expect(result.shortfall).toBeGreaterThan(0);
    expect(result.monthlyNetSavings).toBeGreaterThan(0);
    expect(result.monthsToCloseGap).not.toBeNull();
    expect(result.timingRealityCheck).toContain('Reality check');
  });

  it('does not compute monthsToCloseGap when monthlyNetSavings is zero or negative', () => {
    const result = computeFinancials(
      inputs({
        costs: { flightPerAdult: 1000000, accomPerNight: 0, nights: 0, transport: 0, shopping: 0, sightseeing: 0 },
        funds: { closingBalance: 0, forexSavings: 0 },
        cashFlow: [
          { month: 'Jan', inflow: 50000, outflow: 60000, balance: '' }, // spending more than earning
          { month: 'Feb', inflow: 50000, outflow: 60000, balance: '' },
          ...emptyCashFlow().slice(2),
        ],
      })
    );
    expect(result.monthlyNetSavings).toBeLessThanOrEqual(0);
    expect(result.monthsToCloseGap).toBeNull();
  });
});
