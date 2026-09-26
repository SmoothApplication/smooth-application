// Phase 4 of the bank-statement port (task #244): pure serialize/deserialize helpers for the
// localStorage persistence wired up in web/app/checklist/uk/statement/page.tsx. Kept here (rather
// than inline in the page) so the shape conversion is unit-testable like the rest of this engine,
// and so it stays honest about what is/isn't persisted: only the small plain-data fields a
// ParsedTxn boils down to (dateISO instead of a Date object, credit/debit/balance/narration, and
// the one internal flag the UI actually reads) - never the original file or its raw bytes.

import type { ParsedTxn } from './types';

/** The plain-data shape a ParsedTxn is reduced to for localStorage. Field names intentionally
 * differ slightly from ParsedTxn (dateISO instead of date, amountMatchedReversal instead of the
 * internal __amountMatchedReversal) so the persisted JSON reads clearly on its own without needing
 * the engine's internal-field convention. */
export interface PersistedTxn {
  dateISO: string;
  narration: string;
  credit: number;
  debit: number;
  balance: number;
  amountMatchedReversal?: boolean;
}

/** Everything sa_uk_statement stores. */
export interface PersistedStatement {
  txns: PersistedTxn[];
  applicantName: string;
  maidenName: string;
  nameCorrections: Record<string, string>;
  /** Added for the personal-statement name-tally check (see personalNameTally.ts): the account-
   * holder name detected on this statement's own header at scan time, null if none was found.
   * Optional so a payload saved before this feature existed still loads fine. */
  detectedHolderName?: string | null;
}

export function serializeTxns(txns: ParsedTxn[]): PersistedTxn[] {
  return txns.map((t) => {
    const out: PersistedTxn = {
      dateISO: t.date instanceof Date && !Number.isNaN(t.date.getTime()) ? t.date.toISOString() : '',
      narration: t.narration || '',
      credit: t.credit || 0,
      debit: t.debit || 0,
      balance: t.balance || 0,
    };
    if (t.__amountMatchedReversal) out.amountMatchedReversal = true;
    return out;
  });
}

export function deserializeTxns(txns: PersistedTxn[]): ParsedTxn[] {
  return (txns || []).map((t) => {
    const out: ParsedTxn = {
      date: t.dateISO ? new Date(t.dateISO) : new Date(NaN),
      narration: t.narration || '',
      credit: t.credit || 0,
      debit: t.debit || 0,
      balance: t.balance || 0,
    };
    if (t.amountMatchedReversal) out.__amountMatchedReversal = true;
    return out;
  });
}
