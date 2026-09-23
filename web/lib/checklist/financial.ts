// Phase 3 of task #244: the financial readiness calculator, faithfully ported from index.html's
// computeFinancials() (~index.html:7762-8530). That function is ~800 lines and does far more than
// the maths — it also drives a dozen different DOM elements, an "Analyze statement(s)" OCR upload
// pipeline (Tesseract.js/PDF.js, shared with the document-scanning checklist items), and the
// floating Reasons tab. None of that OCR/document-cross-check machinery is ported here — it's a
// separate, much larger piece of work (browser-side bank-statement parsing) tracked as its own
// later phase. What IS ported, faithfully, is the actual arithmetic a real applicant needs: trip
// cost estimate, the 2x funds-buffer rule, and the 6-month cash-flow / income-stability check —
// exactly the same formulas, just fed from typed inputs instead of an OCR'd statement.
export type Travellers = {
  adults: number;
  adolescents: number;
  children: number;
};

export type TripCosts = {
  flightPerAdult: number; // ₦ per adult; 90%/75% applied for adolescents/children, same as index.html
  accomPerNight: number; // ₦
  nights: number;
  transport: number; // ₦, total
  shopping: number; // ₦, total
  sightseeing: number; // ₦, total
};

export type Funds = {
  closingBalance: number; // ₦
  forexSavings: number; // ₦
};

export type CashFlowRow = {
  month: string;
  inflow: number;
  outflow: number;
  balance: string; // kept as string so an empty field reads as "not entered" rather than 0
};

export const CF_MONTHS = 6;

export function emptyCashFlow(): CashFlowRow[] {
  return Array.from({ length: CF_MONTHS }, () => ({ month: '', inflow: 0, outflow: 0, balance: '' }));
}

export type FinancialInputs = {
  travellers: Travellers;
  costs: TripCosts;
  funds: Funds;
  cashFlow: CashFlowRow[];
  travelDate: string;
  returnDate: string;
  appDate: string;
};

export const DEFAULT_FINANCIAL_INPUTS: FinancialInputs = {
  travellers: { adults: 1, adolescents: 0, children: 0 },
  costs: { flightPerAdult: 0, accomPerNight: 0, nights: 0, transport: 0, shopping: 0, sightseeing: 0 },
  funds: { closingBalance: 0, forexSavings: 0 },
  cashFlow: emptyCashFlow(),
  travelDate: '',
  returnDate: '',
  appDate: '',
};

export function fmtN(n: number): string {
  const rounded = Math.round(n || 0);
  const neg = rounded < 0;
  const abs = Math.abs(rounded);
  const s = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + '₦' + s;
}

export type FinancialResult = {
  travellers: number;
  totalFlight: number;
  totalAccom: number;
  totalCost: number;
  recommendedFunds: number; // 2x buffer, index.html's rule of thumb
  totalFunds: number;
  shortfall: number; // > 0 means short of the recommended buffer
  fundsReady: boolean;
  hasCashFlowData: boolean; // index.html requires >= 2 filled months before trusting the average
  avgIn: number;
  avgOut: number;
  monthlyNetSavings: number;
  incomeStabilityCv: number; // coefficient of variation on monthly inflow; lower = steadier income
  zeroIncomeMonths: number;
  recommendedIncome: number; // same 2x rule, applied to income instead of savings (index.html:7993)
  monthsToCloseGap: number | null; // null if no shortfall or no savings pace to measure against
  daysToPrep: number | null; // days from today to planned submission date
  daysToTravelAfterApp: number | null; // days between application and travel dates
  timingRealityCheck: string; // matches financialTimingRealityCheck() in index.html, '' if no-op
};

export function computeFinancials(inputs: FinancialInputs): FinancialResult {
  const { travellers: t, costs, funds, cashFlow } = inputs;
  const adults = Math.max(0, Math.round(t.adults)) || (t.adolescents + t.children === 0 ? 1 : 0);
  const adolescents = Math.max(0, Math.round(t.adolescents));
  const children = Math.max(0, Math.round(t.children));
  const travellers = adults + adolescents + children || 1;

  const totalFlight = Math.round(costs.flightPerAdult * adults + costs.flightPerAdult * 0.9 * adolescents + costs.flightPerAdult * 0.75 * children);
  const totalAccom = costs.accomPerNight * costs.nights;
  const totalCost = totalFlight + totalAccom + costs.transport + costs.shopping + costs.sightseeing;
  const recommendedFunds = totalCost * 2;
  const totalFunds = funds.closingBalance + funds.forexSavings;
  const shortfall = recommendedFunds - totalFunds;
  const fundsReady = shortfall <= 0 && totalCost > 0;

  const filledRows = cashFlow.filter((r) => r.month || r.inflow || r.outflow || r.balance);
  const hasCashFlowData = filledRows.length >= 2;
  let avgIn = 0;
  let avgOut = 0;
  let incomeStabilityCv = 0;
  let zeroIncomeMonths = 0;
  if (hasCashFlowData) {
    const inflows = filledRows.map((r) => r.inflow);
    zeroIncomeMonths = inflows.filter((v) => v <= 0).length;
    avgIn = inflows.reduce((a, b) => a + b, 0) / inflows.length;
    const variance = inflows.reduce((a, b) => a + Math.pow(b - avgIn, 2), 0) / inflows.length;
    incomeStabilityCv = avgIn > 0 ? Math.sqrt(variance) / avgIn : 0;
    avgOut = filledRows.reduce((a, r) => a + r.outflow, 0) / filledRows.length;
  }
  const monthlyNetSavings = avgIn - avgOut;
  const recommendedIncome = totalCost * 2;

  let daysToPrep: number | null = null;
  if (inputs.appDate) {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const d = Math.round((new Date(inputs.appDate).getTime() - todayMidnight.getTime()) / 86400000);
    if (!isNaN(d)) daysToPrep = d;
  }

  let daysToTravelAfterApp: number | null = null;
  if (inputs.appDate && inputs.travelDate) {
    const d = Math.round((new Date(inputs.travelDate).getTime() - new Date(inputs.appDate).getTime()) / 86400000);
    if (!isNaN(d)) daysToTravelAfterApp = d;
  }

  let monthsToCloseGap: number | null = null;
  let timingRealityCheck = '';
  if (shortfall > 0 && monthlyNetSavings > 0) {
    monthsToCloseGap = shortfall / monthlyNetSavings;
    if (daysToPrep !== null && daysToPrep >= 0) {
      const daysNeeded = monthsToCloseGap * 30.44;
      if (daysNeeded > daysToPrep) {
        timingRealityCheck =
          `Reality check: your planned submission date gives you only ${daysToPrep} day(s) to prepare, but closing this gap by saving alone would take roughly ${Math.ceil(monthsToCloseGap)} more month(s) at that pace — that's not going to happen in time. ` +
          `If you want to keep this travel date, check whether you have any other traceable income (an allowance, a bonus, anything else you can show a paper trail for) that can close the gap faster than salary alone; otherwise the honest move is to push your application (and travel) date back until your savings genuinely catch up.`;
      }
    }
  }

  return {
    travellers,
    totalFlight,
    totalAccom,
    totalCost,
    recommendedFunds,
    totalFunds,
    shortfall,
    fundsReady,
    hasCashFlowData,
    avgIn,
    avgOut,
    monthlyNetSavings,
    incomeStabilityCv,
    zeroIncomeMonths,
    recommendedIncome,
    monthsToCloseGap,
    daysToPrep,
    daysToTravelAfterApp,
    timingRealityCheck,
  };
}
