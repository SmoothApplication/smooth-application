// Port of index.html's Business Income Record ledger (HTML: #bizLedgerCard ~line 2750; JS:
// businessIncomeLedger/renderBusinessIncomeLedger/wireBusinessIncomeLedgerRows ~line 12387-12631,
// and the "Build my Business Income Record" output ~line 15170-15214) — task #319 selection
// "Business income ledger". Pure logic only: filtering which credits on a scanned business
// statement count as a payment worth noting, the applicant's own payer/purpose note per credit,
// and the dated table the "Build" button compiles from those notes.
//
// Deliberately scoped to just the ledger, matching what was offered when this feature was picked:
// NOT the fuller "business statement analysis" the original bundles this into (recurring
// personal-drawing detection via findRecurringPaymentToPerson, and cross-checking those drawings
// against the personal statement — index.html ~12398-12550). That's a separate, larger feature
// this port doesn't build here.
import type { ParsedTxn } from './types';
import { isReversalNarration, isNonIncomeChargeNarration, inflowKey } from './classify';

/** The applicant's own note on one business-statement credit — never styled or claimed as a
 * receipt, just their account of who paid and what it was for (index.html's own framing, kept
 * verbatim in the UI copy). */
export interface BizLedgerEntry {
  payer: string;
  purpose: string;
}

/** inflowKey(t) -> BizLedgerEntry, same stable-key pattern as inflowExplanations elsewhere in this
 * codebase so notes survive a re-scan. */
export type BizLedgerMap = Record<string, BizLedgerEntry>;

/** Which credits on a scanned business statement are worth asking the applicant to explain —
 * ported verbatim from index.html line 12543: real incoming payments only, not a reversed/failed
 * transaction and not a bank/network charge line that happens to be a credit (a refund of a fee,
 * say). */
export function filterBusinessCredits(txns: ParsedTxn[]): ParsedTxn[] {
  return txns.filter((t) => t.credit > 0 && !isReversalNarration(t) && !isNonIncomeChargeNarration(t.narration));
}

/** Ported verbatim from index.html's bizLedgerEntryIsFilled — both fields need real text, not just
 * one, before a row counts as "noted". */
export function bizLedgerEntryIsFilled(e: BizLedgerEntry | undefined | null): boolean {
  return !!(e && e.payer && e.payer.trim() && e.purpose && e.purpose.trim());
}

export function countFilledEntries(credits: ParsedTxn[], ledger: BizLedgerMap): number {
  return credits.filter((t) => bizLedgerEntryIsFilled(ledger[inflowKey(t)])).length;
}

/** One row of the compiled Business Income Record table. */
export interface BizLedgerRow {
  date: Date;
  amount: number;
  payer: string;
  purpose: string;
}

/** Ported from the "Build my Business Income Record" click handler (index.html ~15180-15187):
 * every credit gets a row regardless of whether it's been noted yet, with an explicit
 * "(not specified)" placeholder rather than silently leaving it blank — so a half-finished record
 * still shows exactly what's missing. */
export function buildBizLedgerRows(credits: ParsedTxn[], ledger: BizLedgerMap): BizLedgerRow[] {
  return credits.map((t) => {
    const e = ledger[inflowKey(t)];
    return {
      date: t.date,
      amount: t.credit,
      payer: (e?.payer || '').trim() || '(not specified)',
      purpose: (e?.purpose || '').trim() || '(not specified)',
    };
  });
}

/** Ported from index.html's `unspecified` count (~15188) — drives the "go back and fill those in"
 * warning shown above the compiled table. */
export function countUnspecifiedRows(rows: BizLedgerRow[]): number {
  return rows.filter((r) => r.payer === '(not specified)' || r.purpose === '(not specified)').length;
}
