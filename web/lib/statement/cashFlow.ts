// Direct user report during launch: "when you put in your bank statement, the first thing it shows
// is a report... your six months report doesn't show." Traced to a real gap against the original
// GitHub Pages app: index.html's Financial readiness calculator had a "Monthly cash flow (last 6
// months)" table that auto-filled itself from the very same statement upload used for the income
// analysis (see its own fin-note: "Upload here to auto-fill the cash-flow table and detailed
// reports in the next two steps"). In this Next.js rebuild, the statement upload (StatementSlot/
// StatementDashboard) and the Financial readiness calculator (FinancialCalculator.tsx) became two
// separate, disconnected pieces during the port — the calculator's cashFlow table was left as a
// purely manual-entry field, so an applicant who had already uploaded and fully analyzed their
// statement was still asked to retype 6 months of totals by hand. This restores the auto-fill by
// computing the same month-by-month totals directly from the already-parsed ParsedTxn[] (the exact
// numbers already driving the Analysis/Report tabs), so nothing is re-derived or guessed at twice.
//
// Pure, framework-free logic only — no localStorage/DOM here, same convention as the rest of this
// engine. See FinancialCalculator.tsx for where this is wired in (reads the statement's persisted
// txns, calls this, and seeds the cash-flow table only while it's still empty — never overwrites
// something the applicant already typed by hand).

import type { ParsedTxn } from './types';

/** Matches lib/checklist/financial.ts's CashFlowRow shape structurally (not imported directly, to
 * keep this module's only dependency the statement engine's own types — lib/checklist/financial.ts
 * has no reason to know this function exists). `balance` is kept as a string for the same reason as
 * the original: an untouched field should read as "not entered", not "0". */
export interface MonthlyCashFlowRow {
  month: string;
  inflow: number;
  outflow: number;
  balance: string;
}

/** Groups every txn by calendar month, sums credits/debits per month, and takes the closing
 * balance as the LAST transaction's balance field within that month (assumes txns arrive in
 * chronological order within a month, same as every real bank statement export - if a statement
 * were somehow out of order this would just report the last-seen row's balance for that month,
 * never a crash). Returns at most `months` of the MOST RECENT distinct calendar months found,
 * oldest first (matching the original table's reading order), so a statement spanning e.g. 8
 * months only shows the most recent 6 — never a stale earliest month is used if outflow, since
 * that's what "last 6 months" evidence is actually about (the reviewer wants the most recent
 * history, not the earliest available).
 *
 * Returns [] for no/invalid txns, so callers can safely check `.length` before deciding whether to
 * auto-fill anything. */
export function computeMonthlyCashFlow(txns: ParsedTxn[], months = 6): MonthlyCashFlowRow[] {
  if (!txns || txns.length === 0) return [];

  interface Bucket {
    label: string;
    inflow: number;
    outflow: number;
    lastBalance: number;
    lastSeenIndex: number;
  }
  const byMonth = new Map<string, Bucket>();

  txns.forEach((t, i) => {
    if (!(t.date instanceof Date) || Number.isNaN(t.date.getTime())) return;
    const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
    let bucket = byMonth.get(key);
    if (!bucket) {
      bucket = {
        label: t.date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
        inflow: 0,
        outflow: 0,
        lastBalance: 0,
        lastSeenIndex: -1,
      };
      byMonth.set(key, bucket);
    }
    bucket.inflow += t.credit || 0;
    bucket.outflow += t.debit || 0;
    // Original array order is this statement's own chronological order, so the highest index seen
    // for this month is its closing balance — no separate date comparison needed (and safer than
    // one, since same-day rows would otherwise tie).
    if (i > bucket.lastSeenIndex) {
      bucket.lastSeenIndex = i;
      bucket.lastBalance = t.balance || bucket.lastBalance;
    }
  });

  // "YYYY-MM" keys sort chronologically as plain strings.
  const orderedKeys = Array.from(byMonth.keys()).sort();
  const lastKeys = orderedKeys.slice(-months);

  return lastKeys.map((key) => {
    const b = byMonth.get(key)!;
    return {
      month: b.label,
      inflow: Math.round(b.inflow),
      outflow: Math.round(b.outflow),
      balance: b.lastBalance ? String(Math.round(b.lastBalance)) : '',
    };
  });
}
