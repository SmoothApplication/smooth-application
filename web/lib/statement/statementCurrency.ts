// Direct instruction: "on the issue of six months... the applicant should be given a warning. It
// will still be processed, but you should be told that this bank statement it is not six months."
// Nothing in this engine previously checked whether an uploaded statement is actually a CURRENT,
// up-to-date 6-month window — every existing "6 months" check (workNameCheck's distinctMonthsCount,
// static checklist copy) only asks "how many months of evidence appear inside the file", never
// "is the file itself recent, and does it actually span 6 real months ending near today". A
// statement whose last transaction is 4 months old, or one that only covers 6 weeks, both pass
// every existing check silently. This is deliberately a WARNING, never a block — per the direct
// instruction, the statement is still analyzed and scored normally either way.
import type { ParsedTxn } from './types';

/** How many days old the most recent transaction can be before the statement reads as "not
 * current" — a reviewer expects a statement pulled close to application time, not one that's sat
 * on the applicant's phone for months. 45 days gives real slack for bank processing/export delays
 * without accepting a statement that's genuinely gone stale. */
export const STALE_THRESHOLD_DAYS = 45;

/** How many days the statement's own first-to-last transaction span must cover to count as a
 * genuine "6 months" of history — 150 days (~5 months) rather than a strict 182 to allow for a
 * bank's own export just barely missing a full calendar 6 months at either edge. */
export const MIN_SPAN_DAYS_FOR_SIX_MONTHS = 150;

export interface StatementCurrencyResult {
  /** The statement's own earliest and latest transaction dates — null when there are no valid
   * dates to compare (shouldn't happen for anything that reached scoring, but keeps this safe). */
  earliestDate: Date | null;
  latestDate: Date | null;
  /** Whole days between the statement's own last transaction and `asOf` (today, by default). */
  daysSinceLastTransaction: number | null;
  /** Whole days the statement's own transactions span, end to end. */
  spanDays: number | null;
  /** True only when BOTH the statement is recent enough (daysSinceLastTransaction <=
   * STALE_THRESHOLD_DAYS) AND it genuinely spans close to 6 months (spanDays >=
   * MIN_SPAN_DAYS_FOR_SIX_MONTHS). Either failure alone is enough to warn. */
  isCurrentSixMonths: boolean;
  /** Which specific problem(s) caused isCurrentSixMonths to be false — empty when it's true. Lets
   * the UI/report give a precise reason rather than a generic "not current" message. */
  issues: ('stale' | 'short_span')[];
}

export function computeStatementCurrency(txns: ParsedTxn[], asOf: Date = new Date()): StatementCurrencyResult {
  const validDates = txns
    .map((t) => t.date)
    .filter((d) => d instanceof Date && !Number.isNaN(d.getTime()));

  if (!validDates.length) {
    return {
      earliestDate: null,
      latestDate: null,
      daysSinceLastTransaction: null,
      spanDays: null,
      isCurrentSixMonths: false,
      issues: ['stale', 'short_span'],
    };
  }

  const earliestDate = new Date(Math.min(...validDates.map((d) => d.getTime())));
  const latestDate = new Date(Math.max(...validDates.map((d) => d.getTime())));

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const daysSinceLastTransaction = Math.round((asOf.getTime() - latestDate.getTime()) / MS_PER_DAY);
  const spanDays = Math.round((latestDate.getTime() - earliestDate.getTime()) / MS_PER_DAY);

  const issues: StatementCurrencyResult['issues'] = [];
  if (daysSinceLastTransaction > STALE_THRESHOLD_DAYS) issues.push('stale');
  if (spanDays < MIN_SPAN_DAYS_FOR_SIX_MONTHS) issues.push('short_span');

  return {
    earliestDate,
    latestDate,
    daysSinceLastTransaction,
    spanDays,
    isCurrentSixMonths: issues.length === 0,
    issues,
  };
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Plain-language warning banner text — null when the statement is genuinely current, so callers
 * can render nothing rather than a spurious "all good" banner (the rest of the UI already covers
 * that). Deliberately reassuring that this does NOT block anything, per the direct instruction. */
export function buildStatementCurrencyWarning(result: StatementCurrencyResult): string | null {
  if (result.isCurrentSixMonths) return null;
  if (!result.latestDate || !result.earliestDate) {
    return "We couldn't read valid transaction dates from this statement to check how current it is — double-check the file is a real bank export, not a photo with dates that failed to read correctly.";
  }

  const parts: string[] = [];
  if (result.issues.includes('stale')) {
    parts.push(
      `its most recent transaction is dated ${fmtDate(result.latestDate)} — ${result.daysSinceLastTransaction} days ago`
    );
  }
  if (result.issues.includes('short_span')) {
    parts.push(
      `it only covers ${fmtDate(result.earliestDate)} to ${fmtDate(result.latestDate)}, which is short of a genuine 6-month history`
    );
  }

  return `This statement is not a current, up-to-date 6-month statement — ${parts.join(
    ' and '
  )}. It will still be processed and scored below, but reviewers expect a statement pulled close to your application date covering a full 6 months; consider uploading a fresher export if you have one.`;
}
