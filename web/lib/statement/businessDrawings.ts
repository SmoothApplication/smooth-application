// Port of index.html's "fuller business statement analysis" — the cross-referencing between a
// BUSINESS statement (money leaving, to the applicant) and a PERSONAL statement (money arriving),
// ~line 12371-12426. This is the piece explicitly deferred when the Business Income Record ledger
// shipped (see business.ts's own header comment) — task follow-up selection "Fuller business
// statement analysis".
//
// findRecurringPaymentToPerson() itself (the "does the business statement show a recurring
// personal drawing?" half) was already ported in names.ts (RecurringPaymentToPersonResult /
// findRecurringPaymentToPerson) as part of the original bank-statement-engine port — this file
// adds the second half: cross-checking those drawings against the personal statement's own
// credits, plus the message-building the original inlined into runBusinessStatementAnalysis's
// `results.push(...)` calls (~12522-12552), pulled out here as pure, testable functions rather
// than DOM strings.
import { fmtN } from '../checklist/financial';
import type { RecurringPaymentToPersonResult } from './types';

/** A bank-to-bank transfer can take a few days to land — same window the original used. */
export const CROSSCHECK_DAY_WINDOW = 10;
/** Allow for bank fees/rounding between the two statements — same tolerance as the original. */
export const CROSSCHECK_AMOUNT_TOLERANCE = 0.12;

export interface CrossCheckResult {
  matched: number;
  total: number;
}

/** A same-shape {date, amount} pair — what both RecurringPaymentToPersonResult.transactions and a
 * personal statement's credits reduce to for this comparison. */
export interface DateAmount {
  date: Date;
  amount: number;
}

/** Ported verbatim from crossCheckBusinessDrawings (index.html ~12398-12412). Returns null when
 * there's nothing to check yet — no business drawings detected, or the personal statement hasn't
 * been scanned at all — matching the original's early-return behavior. */
export function crossCheckBusinessDrawings(
  businessDrawings: DateAmount[] | null | undefined,
  personalCredits: DateAmount[] | null | undefined
): CrossCheckResult | null {
  if (!businessDrawings || !personalCredits) return null;
  if (!businessDrawings.length) return null;

  let matched = 0;
  businessDrawings.forEach((bt) => {
    const found = personalCredits.some((pt) => {
      const dayGap = Math.abs(bt.date.getTime() - pt.date.getTime()) / 86400000;
      if (dayGap > CROSSCHECK_DAY_WINDOW) return false;
      const amountGap = Math.abs(bt.amount - pt.amount) / Math.max(bt.amount, 1);
      return amountGap <= CROSSCHECK_AMOUNT_TOLERANCE;
    });
    if (found) matched++;
  });
  return { matched, total: businessDrawings.length };
}

export type DrawingMessageStatus = 'ok' | 'warn';

export interface DrawingMessage {
  status: DrawingMessageStatus;
  message: string;
}

/** Ported verbatim from the two `bizIncomeEl`/`results.push` branches keyed on `match.monthsSeen`
 * (index.html ~12535-12541). `totalMonths` is the number of months the statement itself covers
 * (aggregateTransactions' month count), used only for the "X of Y months" phrasing. */
export function buildRecurringDrawingMessage(
  match: RecurringPaymentToPersonResult,
  totalMonths: number
): DrawingMessage {
  if (match.monthsSeen >= 2) {
    return {
      status: 'ok',
      message: `Found what looks like a recurring personal payment (salary/drawing) to you, about ${fmtN(match.avgAmount)}, in ${match.monthsSeen} of ${totalMonths} month(s) - this is exactly what a caseworker wants to see: money moving from the business to you personally, not just sitting in the business account.`,
    };
  }
  return {
    status: 'warn',
    message:
      "Couldn't find a clear, recurring personal payment from the business to you. Under UK immigration rules, a business is a separate legal entity from its director - the business having money is not the same as you having money. If you're not yet drawing a regular salary or dividend, start doing so and keep records, and make sure that payment also shows up on your own personal bank statement above.",
  };
}

/** Ported verbatim from appendCrossCheckMessage's three branches (index.html ~12419-12424). Only
 * called once crossCheckBusinessDrawings() has returned a non-null result with total > 0. */
export function buildCrossCheckMessage(cc: CrossCheckResult): DrawingMessage {
  if (cc.matched === 0) {
    return {
      status: 'warn',
      message: `Cross-checked against your other statement: none of the ${cc.total} business-to-you payment(s) could be matched to an inflow on your personal statement (within ${CROSSCHECK_DAY_WINDOW} days and a similar amount). A reviewer wants to see the same payment leaving the business account and landing in your personal one - double-check the dates/amounts, or make sure both statements cover the same months.`,
    };
  }
  if (cc.matched < cc.total) {
    return {
      status: 'warn',
      message: `Cross-checked against your other statement: ${cc.matched} of ${cc.total} business-to-you payment(s) were matched to an inflow on your personal statement. The rest couldn't be matched - worth double-checking those specific dates/amounts on both statements.`,
    };
  }
  return {
    status: 'ok',
    message: `Cross-checked against your other statement: all ${cc.matched} of ${cc.total} business-to-you payment(s) were also found landing in your personal account - this is exactly the kind of verifiable, traceable evidence a caseworker wants to see that you're genuinely being paid from your business.`,
  };
}
