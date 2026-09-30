// Direct follow-up to the "expert-grade" real-statement audit (task #470): workNameCheck.ts already
// confirms an employer/business NAME shows up as a real inflow sender, but it never compares the
// AMOUNT landing against what the applicant actually claims to earn. That's exactly the kind of
// judgment call a 20-year statement reviewer applies by eye and the pipeline didn't yet: "salary
// claimed ₦500k/month, but only ₦50k/month is actually landing here" is a real, specific,
// actionable red flag — this module makes it a first-class, always-computed check instead of
// something only a human reviewer might happen to notice.
//
// Deliberately narrow in scope: this only compares a declared MONTHLY amount against the average
// monthly total of inflows already matched to that employer/business name by computeWorkNameCheck
// (workNameCheck.ts). It says nothing about occupation/job-title plausibility (that field doesn't
// exist anywhere in this app yet — a separate, larger follow-up) and nothing about inflows NOT
// matched to a declared name (findUnexplainedLargeInflows already covers "money with no clear
// source" separately). This is specifically: does the money that IS confirmed to come from your
// stated employer/business match what you say that employer/business pays you?
import type { WorkNameCheckResult, WorkNameLabel } from './workNameCheck';
import { fmtN } from '../checklist/financial';

/** How far actual can drift from declared before it's flagged, as a fraction of the declared
 * amount. 30% allows for ordinary month-to-month pay variance (overtime, a late payment landing in
 * the next month's window, a bonus month) without flagging normal irregularity as a mismatch — the
 * same kind of deliberately generous threshold as the ₦50,000 unexplained-inflow floor elsewhere in
 * this engine, chosen to only surface genuinely actionable gaps, not routine noise. */
export const INCOME_MATCH_TOLERANCE = 0.3;

export type IncomeMatchVerdict = 'match' | 'below_declared' | 'above_declared';

export interface IncomeMatchResult {
  label: WorkNameLabel;
  declaredMonthlyIncome: number;
  actualMonthlyAverage: number;
  monthsObserved: number;
  verdict: IncomeMatchVerdict;
  /** Positive when actual falls short of declared, negative when actual exceeds declared — signed
   * so callers can show "42% below" vs "18% above" without re-deriving the sign themselves. */
  percentDiff: number;
}

/** Returns null when there's nothing meaningful to compare: no declared amount typed yet, or the
 * name check found no direct inflow sender to average (an employer/business that's only mentioned
 * in passing text, or not found at all, is workNameCheck.ts's own job to flag — this check only
 * activates once there's a real number to compare against). */
export function computeIncomeMatch(
  label: WorkNameLabel,
  declaredMonthlyIncome: number,
  check: WorkNameCheckResult
): IncomeMatchResult | null {
  if (!declaredMonthlyIncome || declaredMonthlyIncome <= 0) return null;
  if (!check.inflowMatches.length || check.distinctMonthsCount <= 0) return null;

  const actualMonthlyAverage = check.inflowTotal / check.distinctMonthsCount;
  const percentDiff = (declaredMonthlyIncome - actualMonthlyAverage) / declaredMonthlyIncome;

  let verdict: IncomeMatchVerdict = 'match';
  if (percentDiff > INCOME_MATCH_TOLERANCE) verdict = 'below_declared';
  else if (percentDiff < -INCOME_MATCH_TOLERANCE) verdict = 'above_declared';

  return {
    label,
    declaredMonthlyIncome,
    actualMonthlyAverage,
    monthsObserved: check.distinctMonthsCount,
    verdict,
    percentDiff,
  };
}

export type IncomeMatchMessageStatus = 'ok' | 'warn';

export interface IncomeMatchMessage {
  status: IncomeMatchMessageStatus;
  message: string;
}

/** Mirrors buildWorkNameCheckMessages' plain-language, reviewer-framed tone (workNameCheck.ts). A
 * shortfall is the actionable case — worded as something to explain or fix, the same way the "big
 * narrations" report frames an unexplained inflow. Actual exceeding declared is worded as a neutral
 * note, not a warning: extra income landing from your own stated employer/business is not itself a
 * red flag (it may just mean the figure you typed was conservative, or a bonus month) - it's still
 * surfaced so the applicant can double-check they typed the right number, not because more money is
 * suspicious. */
export function buildIncomeMatchMessage(result: IncomeMatchResult): IncomeMatchMessage {
  const pct = Math.round(Math.abs(result.percentDiff) * 100);
  const monthsNote = `averaged over ${result.monthsObserved} month${result.monthsObserved === 1 ? '' : 's'} of confirmed ${result.label} inflow`;

  if (result.verdict === 'below_declared') {
    return {
      status: 'warn',
      message: `You entered ${fmtN(result.declaredMonthlyIncome)}/month as your income from this ${result.label}, but only ${fmtN(
        result.actualMonthlyAverage
      )}/month is actually landing in this statement (${monthsNote}) — ${pct}% below what you declared. Reviewers cross-check the amount you claim against what the statement actually shows, not just whether the name matches; be ready to explain the gap (deductions, a change in pay, income landing elsewhere) or correct the figure you entered.`,
    };
  }

  if (result.verdict === 'above_declared') {
    return {
      status: 'ok',
      message: `You entered ${fmtN(result.declaredMonthlyIncome)}/month as your income from this ${result.label}, and ${fmtN(
        result.actualMonthlyAverage
      )}/month is actually landing in this statement (${monthsNote}) — ${pct}% above what you declared. Not a red flag on its own, but worth double-checking you typed the right figure.`,
    };
  }

  return {
    status: 'ok',
    message: `The ${fmtN(result.actualMonthlyAverage)}/month actually landing from this ${result.label} (${monthsNote}) matches the ${fmtN(
      result.declaredMonthlyIncome
    )}/month you declared — exactly the kind of consistency a reviewer checks for.`,
  };
}
