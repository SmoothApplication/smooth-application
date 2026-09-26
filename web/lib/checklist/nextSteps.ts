// Port of index.html's "What to do next" report — renderNextStepsReport(a), ~line 7483-7592 —
// task #319+ selection "'What to do next' report". Synthesizes three already-tracked things
// (passport validity, travel history, finance readiness) into one page, plus a time-to-travel
// prioritized breakdown and an overall verdict.
//
// This is the last of the three "What to do next" prerequisites: passport validity reuses
// lib/passport's own field storage, travel history reuses lib/checklist/travelHistory.ts (built
// just for this report), and finance readiness reuses lib/checklist/financial.ts's
// computeFinancials() — but that function's pure FinancialResult doesn't carry the DOM-pill
// good/warning/critical/neutral vocabulary the original reads (readinessStatusFromPill), nor the
// unexplained-inflow count that vocabulary itself depends on (a bank-statement-scan-derived signal,
// window.__lastUnexplainedInflows, that isn't part of FinancialResult). computeFinanceReadiness()
// below is a deliberately simplified 3-state proxy built from FinancialResult alone:
//   - balance: 'missing' (nothing entered) / 'needs_review' (entered but not yet at the 2x buffer,
//     or no trip cost to compare against — the original's warning/critical/"detected, no trip cost"
//     states collapse into one here) / 'looks_complete' (fundsReady)
//   - income: 'missing' (no cash-flow data) / 'needs_review' (a zero-income month, or month-to-month
//     variance over the original's own 40% threshold) / 'looks_complete' (neither) — dropping the
//     unexplained-inflow half of the original's score entirely, since that data doesn't exist here.
// This loses some precision (a "Weak - below the floor" balance and a "Needs attention - below 2x
// buffer" balance both just read as "needs review" here) but keeps the report honest: it only ever
// says looks_complete when the original's own arithmetic would agree.
//
// The passport section does NOT reuse lib/passport/validity.ts's getPassportValidityStatus() —
// that function deliberately checks 6 months from TODAY (see its own header comment), because it
// runs from the passport-scan page alone with no guaranteed travel date. This report DOES have a
// travel date on hand (from the financial calculator's own saved inputs) when one's been entered,
// and the original's renderNextStepsReport specifically grades against 6 months from the TRAVEL
// DATE (falling back to today only when no travel date exists yet) — so this file ports that exact
// logic fresh as computePassportSection() rather than reusing the today-only checker.
import {
  TravelHistoryRow,
  OverstayRow,
  TE_HIGH_SUCCESS_COUNTRIES,
  parseTravelDays,
} from './travelHistory';
import { FinancialResult } from './financial';

export type SectionStatus = 'ok' | 'warn' | 'info';

export interface NextStepsSection {
  status: SectionStatus;
  message: string;
}

export type FinanceSubStatus = 'missing' | 'needs_review' | 'looks_complete';

export interface FinanceReadinessProxy {
  balanceStatus: FinanceSubStatus;
  incomeStatus: FinanceSubStatus;
}

// Same 0.4 coefficient-of-variation threshold as index.html's incomeIssue check (~line 8274).
const INCOME_VARIANCE_THRESHOLD = 0.4;

// Port of the balancePillEl/incomePillEl classification (index.html ~8347-8423), reduced to a
// 3-state proxy over FinancialResult alone — see this file's header comment for what's lost.
export function computeFinanceReadiness(financial: FinancialResult): FinanceReadinessProxy {
  const haveBalanceFigure = financial.totalFunds > 0;
  let balanceStatus: FinanceSubStatus;
  if (!haveBalanceFigure) {
    balanceStatus = 'missing';
  } else if (financial.fundsReady) {
    balanceStatus = 'looks_complete';
  } else {
    balanceStatus = 'needs_review';
  }

  let incomeStatus: FinanceSubStatus;
  if (!financial.hasCashFlowData) {
    incomeStatus = 'missing';
  } else {
    const incomeIssue = financial.zeroIncomeMonths > 0 || financial.incomeStabilityCv > INCOME_VARIANCE_THRESHOLD;
    incomeStatus = incomeIssue ? 'needs_review' : 'looks_complete';
  }

  return { balanceStatus, incomeStatus };
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

// Port of renderNextStepsReport()'s passport block (index.html ~7490-7511). Returns null for
// passportOk when there isn't enough information yet (nothing entered, or an unparseable date) —
// same "null = not enough info to judge" meaning the original used.
export function computePassportSection(
  passportExpiry: string,
  travelDate: string,
  visaShortLabel: string
): { passportOk: boolean | null; section: NextStepsSection } {
  if (!passportExpiry) {
    return {
      passportOk: null,
      section: {
        status: 'info',
        message: 'Passport expiry not entered yet - fill it in on the passport scan page so this can be checked.',
      },
    };
  }

  const expiryDate = new Date(passportExpiry + 'T00:00:00');
  if (Number.isNaN(expiryDate.getTime())) {
    return {
      passportOk: null,
      section: {
        status: 'info',
        message: "The passport expiry date entered doesn't look valid - double check it on the passport scan page.",
      },
    };
  }

  const travelDateObj = travelDate ? new Date(travelDate) : null;
  const refDate = travelDateObj && !Number.isNaN(travelDateObj.getTime()) ? travelDateObj : new Date();
  const sixAfter = addMonths(refDate, 6);
  const passportOk = expiryDate >= sixAfter;

  if (passportOk) {
    return {
      passportOk,
      section: {
        status: 'ok',
        message: `Your passport clears the 6-months-beyond-travel-date rule most ${visaShortLabel} reviewers expect - no action needed here.`,
      },
    };
  }
  return {
    passportOk,
    section: {
      status: 'warn',
      message:
        'Your passport does not clear the 6-months-beyond-travel-date rule. Renew it before applying - this is worth fixing first, since nothing else on this checklist can compensate for an invalid passport.',
    },
  };
}

// Port of renderNextStepsReport()'s travel-history block (index.html ~7513-7540). Reasons-tab
// integration deliberately not carried over, same note as computeTravelExperienceGrade() in
// travelHistory.ts — the "See the Reasons tab" pointer is dropped from the "has history" message
// since travel-history findings aren't wired into that tab in this port.
export function computeTravelHistorySection(
  firstTimeAnswer: '' | 'yes' | 'no',
  historyRows: TravelHistoryRow[],
  overstayRows: OverstayRow[],
  financeLooksStrong: boolean,
  visaShortLabel: string
): NextStepsSection {
  if (!firstTimeAnswer) {
    return {
      status: 'info',
      message: 'Not answered yet - fill in the Travel Experience page so this can be checked.',
    };
  }

  const historyCountries = historyRows.map((r) => r.country).filter(Boolean);

  if (!historyCountries.length) {
    const easySuggestion = financeLooksStrong
      ? 'Since your finances are already looking strong, South Africa - which also tends to have a comparatively higher success rate - is worth considering alongside the easier options.'
      : 'Ghana, Kenya, Ethiopia, or Morocco are commonly used as a first destination to build a travel history before applying somewhere more demanding.';
    return {
      status: 'warn',
      message: `No travel history on file yet - a first-time application is judged on paper alone, with nothing to show a reviewer you've travelled and returned before. ${easySuggestion} A completed, overstay-free trip there is commonly seen as a positive factor for a later ${visaShortLabel} application.`,
    };
  }

  const visitedHighSuccess = historyCountries.some((c) => TE_HIGH_SUCCESS_COUNTRIES.indexOf(c) !== -1);
  const overstayedAny = overstayRows.some((r) => r.country && parseTravelDays(r.days) > 0);

  if (overstayedAny) {
    return {
      status: 'warn',
      message:
        'You have some travel history, but an overstay is on record - be upfront about it with a clear explanation. This is a real factor reviewers weigh heavily, so it\'s worth addressing directly rather than hoping it goes unnoticed.',
    };
  }

  const historyBits = visitedHighSuccess ? ' (including South Africa, Morocco, and/or Kenya)' : '';
  return {
    status: 'ok',
    message: `You have travel history on file${historyBits}, with no recorded overstay - this is commonly seen as a positive factor.`,
  };
}

// Port of renderNextStepsReport()'s finance block (index.html ~7542-7558), fed by
// computeFinanceReadiness() above instead of readinessStatusFromPill().
export function computeFinanceSection(
  proxy: FinanceReadinessProxy,
  authority: string,
  statementsMonthsText: string
): { section: NextStepsSection; financeEntered: boolean; financeStrong: boolean } {
  const financeEntered = proxy.balanceStatus !== 'missing' || proxy.incomeStatus !== 'missing';
  const financeStrong = proxy.balanceStatus === 'looks_complete' && proxy.incomeStatus === 'looks_complete';

  if (!financeEntered) {
    return {
      financeEntered,
      financeStrong,
      section: {
        status: 'info',
        message: 'Finances not entered yet - fill in the bank statement check and the Financial readiness calculator so this can be checked.',
      },
    };
  }

  if (financeStrong) {
    return {
      financeEntered,
      financeStrong,
      section: {
        status: 'ok',
        message: `Your closing balance and income both look strong against ${authority || 'the'}'s usual ${statementsMonthsText || '6 months'} of statements - you're good to go here.`,
      },
    };
  }

  const gaps: string[] = [];
  if (proxy.balanceStatus !== 'looks_complete') gaps.push('build up your closing balance');
  if (proxy.incomeStatus !== 'looks_complete') gaps.push('make your income more consistent and fully explained');
  return {
    financeEntered,
    financeStrong,
    section: {
      status: 'warn',
      message: `Not quite there yet - ${gaps.join(' and ')} over the next ${statementsMonthsText || '6 months'} of statements before applying. Build your statement history first rather than applying on a weak one.`,
    },
  };
}

export interface TimeToTravelBreakdown {
  daysToTravel: number;
  /** Empty = tracking well across passport/history/finance; otherwise a priority-ordered list. */
  priorities: string[];
}

// Port of renderNextStepsReport()'s time-to-travel block (index.html ~7560-7578). Returns null
// outside the original's 0-100 day window (including when there's no travel date at all).
export function computeTimeToTravel(
  travelDate: string,
  passportOk: boolean | null,
  hasHistory: boolean,
  financeStrong: boolean
): TimeToTravelBreakdown | null {
  if (!travelDate) return null;
  const td = new Date(travelDate);
  if (Number.isNaN(td.getTime())) return null;
  const daysToTravel = Math.round((td.getTime() - Date.now()) / 86400000);
  if (daysToTravel < 0 || daysToTravel > 100) return null;

  const priorities: string[] = [];
  if (passportOk === false) priorities.push('Renew your passport first - it blocks everything else on this list.');
  if (!hasHistory) priorities.push('Consider an easier destination now to start building travel history, if time allows.');
  if (!financeStrong) priorities.push('Focus on strengthening your finances - closing balance and income consistency.');

  return { daysToTravel, priorities };
}

// Port of renderNextStepsReport()'s overall verdict (index.html ~7580-7589).
export function computeOverallVerdict(
  passportOk: boolean | null,
  financeEntered: boolean,
  financeStrong: boolean
): NextStepsSection {
  if (passportOk === true && financeStrong) {
    return { status: 'ok', message: "Overall: you're in a good position to move on to document collection below." };
  }
  if (passportOk === null && !financeEntered) {
    return { status: 'info', message: 'Overall: fill in the sections above (or the linked pages) for a real verdict here.' };
  }
  return {
    status: 'warn',
    message:
      'Overall: a few things above are worth addressing before you dive into document collection - passport, travel history, and finances all feed into how strong your application looks.',
  };
}

export interface NextStepsInputs {
  visaShortLabel: string;
  authority: string;
  statementsMonthsText: string;
  passportExpiry: string;
  travelDate: string;
  firstTimeAnswer: '' | 'yes' | 'no';
  historyRows: TravelHistoryRow[];
  overstayRows: OverstayRow[];
  financial: FinancialResult;
}

export interface NextStepsReport {
  passport: NextStepsSection;
  travelHistory: NextStepsSection;
  finance: NextStepsSection;
  timeToTravel: TimeToTravelBreakdown | null;
  overall: NextStepsSection;
}

// Top-level assembly, mirroring renderNextStepsReport()'s own section order.
export function buildNextStepsReport(inputs: NextStepsInputs): NextStepsReport {
  const { passportOk, section: passportSection } = computePassportSection(
    inputs.passportExpiry,
    inputs.travelDate,
    inputs.visaShortLabel
  );

  const financeProxy = computeFinanceReadiness(inputs.financial);
  const { section: financeSection, financeEntered, financeStrong } = computeFinanceSection(
    financeProxy,
    inputs.authority,
    inputs.statementsMonthsText
  );

  const travelHistorySection = computeTravelHistorySection(
    inputs.firstTimeAnswer,
    inputs.historyRows,
    inputs.overstayRows,
    financeProxy.balanceStatus === 'looks_complete',
    inputs.visaShortLabel
  );

  const hasHistory = inputs.historyRows.map((r) => r.country).filter(Boolean).length > 0;
  const timeToTravel = computeTimeToTravel(inputs.travelDate, passportOk, hasHistory, financeStrong);
  const overall = computeOverallVerdict(passportOk, financeEntered, financeStrong);

  return {
    passport: passportSection,
    travelHistory: travelHistorySection,
    finance: financeSection,
    timeToTravel,
    overall,
  };
}
