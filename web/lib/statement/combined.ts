// Task #420 (direct request): corporate applicants are frequently barred by their employer from
// receiving any income other than salary into their salary account, so a second inflow — a side
// business, rental income, help from parents — ends up in a completely separate account. Until
// now this app only ever let someone analyze ONE statement at a time (StatementCheck.tsx's file
// input has no `multiple`, and every re-upload fully replaced whatever was there — see
// clearSaved()). This module is the pure-logic half of adding a second, independent statement slot
// and summarizing both together — the "combined balance to take to the embassy" the request asked
// for.
//
// Deliberately does NOT merge the two statements' transactions into one list. Each ParsedTxn.balance
// is a running balance that only makes sense within its own account — interleaving two accounts'
// rows by date would produce a nonsensical balance column. Likewise, income-source detection stays
// per-statement (classify.ts already handles that internally); this module only adds the number a
// combined evidence pack actually needs: each account's own closing balance and date range, plus
// their sum/span.
import type { ParsedTxn } from './types';

export interface StatementSummary {
  /** Applicant-editable label, e.g. "Salary account" / "Side business account". Defaults to
   * "Statement 1" / "Statement 2" if never renamed — see StatementSlot.tsx. */
  label: string;
  txnCount: number;
  firstDate: Date | null;
  lastDate: Date | null;
  /** The last row's running balance — the account's closing balance as of the statement's most
   * recent transaction. Assumes txns are in the same chronological order the parser already
   * produces them in (oldest first), same assumption StatementCheck.tsx's own date-range display
   * already makes (txns[0] / txns[txns.length - 1]). */
  closingBalance: number;
}

export interface CombinedSummary {
  statements: StatementSummary[];
  totalClosingBalance: number;
  earliestDate: Date | null;
  latestDate: Date | null;
}

export function summarizeStatement(label: string, txns: ParsedTxn[]): StatementSummary {
  if (!txns.length) {
    return { label, txnCount: 0, firstDate: null, lastDate: null, closingBalance: 0 };
  }
  return {
    label,
    txnCount: txns.length,
    firstDate: txns[0].date,
    lastDate: txns[txns.length - 1].date,
    closingBalance: txns[txns.length - 1].balance || 0,
  };
}

export function combineStatementSummaries(summaries: StatementSummary[]): CombinedSummary {
  const withDates = summaries.filter((s) => s.txnCount > 0);
  const allFirsts = withDates
    .map((s) => s.firstDate)
    .filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()));
  const allLasts = withDates
    .map((s) => s.lastDate)
    .filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()));
  return {
    statements: summaries,
    totalClosingBalance: withDates.reduce((sum, s) => sum + s.closingBalance, 0),
    earliestDate: allFirsts.length ? new Date(Math.min(...allFirsts.map((d) => d.getTime()))) : null,
    latestDate: allLasts.length ? new Date(Math.max(...allLasts.map((d) => d.getTime()))) : null,
  };
}
