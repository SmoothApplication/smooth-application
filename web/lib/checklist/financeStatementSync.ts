// Direct user report (live, mid-session): "bank statement has been uploaded and analyzed, yet
// finances is reading 0". The sidebar's Finances score (ChecklistSidebar.tsx) is computed entirely
// from sa_<code>_financial — historically written ONLY by FinancialCalculator.tsx, a separate,
// later session the applicant hadn't visited yet. FinancialCalculator.tsx already auto-fills its
// own cash-flow table from an analyzed statement (task #454's fix), but only once the applicant
// actually opens that page — someone who'd just finished the bank-statement session, with real
// evidence sitting right there (closing balance, months of cash flow), still saw a flat 0%/"Enter
// your figures" score.
//
// This does the same derivation FinancialCalculator.tsx does, but runs it the moment the statement
// is analyzed (wired into StatementDashboard.tsx), and writes straight into sa_<code>_financial so
// the sidebar has real data without requiring a detour through the Financial calculator first.
// Same non-destructive convention as everywhere else this pattern is used in this codebase: never
// overwrites a closing balance or cash-flow row the applicant already typed by hand, whether just
// now or on an earlier visit to the calculator.
import { computeMonthlyCashFlow, deserializeTxns, PersistedStatement } from '@/lib/statement';
import { CF_MONTHS, DEFAULT_FINANCIAL_INPUTS, FinancialInputs } from './financial';
import { dispatchFinancialUpdated } from './liveUpdateEvents';
import * as secureStorage from '@/lib/security/secureStorage';

/** Reads every persisted statement (both slots, dual-account support from task #420) for a given
 * country and returns their parsed transactions combined. Shared by FinancialCalculator.tsx (its
 * own cash-flow auto-fill) and syncFinancialInputsFromStatement below, so the two never drift. */
export function readPersistedTxnsForCashFlow(lowerCode: string) {
  const keys = [`sa_${lowerCode}_statement`, `sa_${lowerCode}_statement_2`];
  const all = [];
  for (const key of keys) {
    try {
      const raw = secureStorage.getItem(key);
      if (!raw) continue;
      const parsed: PersistedStatement = JSON.parse(raw);
      if (parsed?.txns?.length) all.push(...deserializeTxns(parsed.txns));
    } catch {
      /* nothing usable under this key */
    }
  }
  return all;
}

function cashFlowIsEmpty(rows: FinancialInputs['cashFlow']): boolean {
  return rows.every((r) => !r.month && !r.inflow && !r.outflow && !r.balance);
}

/** Seeds sa_<code>_financial's cash-flow table and closing balance straight from whatever bank
 * statement(s) have already been analyzed, the moment they're analyzed — so the sidebar's Finances
 * score reflects real evidence immediately, not only after a later visit to the Financial
 * calculator. Safe to call repeatedly (e.g. on every StatementDashboard render where txns change):
 * it's a no-op once the applicant has real typed data of their own, and a no-op if there's nothing
 * usable to derive yet. Dispatches FINANCIAL_UPDATED_EVENT only when it actually writes something,
 * so ChecklistSidebar (or any other listener) can re-read without a page reload. */
export function syncFinancialInputsFromStatement(lowerCode: string): void {
  if (typeof window === 'undefined') return;
  const txns = readPersistedTxnsForCashFlow(lowerCode);
  if (!txns.length) return;
  const rows = computeMonthlyCashFlow(txns, CF_MONTHS);
  if (!rows.length) return;
  const lastWithBalance = [...rows].reverse().find((r) => r.balance);
  const derivedClosingBalance = lastWithBalance ? Number(lastWithBalance.balance) || 0 : 0;

  const storageKey = `sa_${lowerCode}_financial`;
  let current: FinancialInputs = DEFAULT_FINANCIAL_INPUTS;
  try {
    const raw = secureStorage.getItem(storageKey);
    if (raw) current = { ...DEFAULT_FINANCIAL_INPUTS, ...JSON.parse(raw) };
  } catch {
    /* start fresh */
  }

  const cashFlowUntouched = cashFlowIsEmpty(current.cashFlow);
  const closingBalanceUntouched = !current.funds.closingBalance;
  if (!cashFlowUntouched && !closingBalanceUntouched) return; // real typed data already exists - never overwrite it

  const next: FinancialInputs = {
    ...current,
    cashFlow: cashFlowUntouched ? rows : current.cashFlow,
    funds: {
      ...current.funds,
      closingBalance: closingBalanceUntouched ? derivedClosingBalance : current.funds.closingBalance,
    },
  };

  // Skip the write (and the event) if nothing would actually change - avoids an infinite render
  // loop from a caller that re-runs this on every render.
  if (JSON.stringify(next) === JSON.stringify(current)) return;

  try {
    secureStorage.setItem(storageKey, JSON.stringify(next));
    dispatchFinancialUpdated();
  } catch {
    /* best effort - the applicant's own typed figures are never at risk either way */
  }
}
