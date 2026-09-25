// Shared types for the bank-statement parsing/classification engine, ported from index.html.
// This module is PURE LOGIC — no DOM, no PDF.js/Tesseract/XLSX browser APIs, no persistence/
// localStorage wiring. Those live in a later pass; here we only need the shapes pure functions
// consume and produce.

/** A single text run positioned on a line, as pdf.js's text layer (or a synthesized stand-in
 * for OCR/plaintext/spreadsheet sources) would produce it. */
export interface LinePart {
  x: number;
  str: string;
}

/** One "line" of statement text — either a real PDF text-layer line (with x-positioned parts,
 * enabling column detection) or a plain-text/OCR line (parts: []). */
export interface Line {
  text: string;
  parts: LinePart[];
  /** Which page this line came from (PDF sources only) — used to make sure narration-wrap /
   * split-date merging never crosses a page boundary. */
  __page?: number;
  /** Continuation narration text absorbed from trailing wrapped lines (see
   * mergeWrappedNarrationLines) — kept separate from the row's own date/amount cells so
   * buildCleanNarration can drop the duplicated date/amount text while keeping this. */
  __wrapExtra?: string;
}

/** A detected debit/credit/balance header occurrence: which line index it was found on, and the
 * x-position of each column. */
export interface ColumnPositions {
  debit?: number;
  credit?: number;
  balance?: number;
}

export interface ColumnOccurrence {
  index: number;
  cols: ColumnPositions;
}

/** A single parsed transaction row. */
export interface ParsedTxn {
  date: Date;
  credit: number;
  debit: number;
  balance: number;
  narration: string;
  /** Set by markAmountMatchedReversals when a credit's amount+narration match an earlier debit
   * closely enough to be treated as a reversal, even with no RVSL/reversal keyword present. */
  __amountMatchedReversal?: boolean;
  /** Set by findUnexplainedLargeInflows: why this inflow was flagged ('blank' narration or
   * 'vague' — has narration text but none of the recognised description keywords). */
  __flagReason?: 'blank' | 'vague';
}

/** One aggregated month's inflow/outflow totals, as produced by aggregateTransactions. */
export interface MonthAggregate {
  year: number;
  month: number;
  inflow: number;
  outflow: number;
  lastDate: Date;
  lastBalance: number;
}

/** A [{name, precededBy}] entry from extractNameCandidatesDetailed — precededBy is the
 * stopword token (if any) flushed immediately before this name run started. */
export interface NameCandidate {
  name: string;
  precededBy: string | null;
}

export interface StableIncome {
  amount: number;
  monthsSeen: number;
}

export interface IncomeSourceNameResult {
  name: string;
  monthsSeen: number;
}

export interface TopIncomeSource {
  name: string;
  count: number;
  monthsSeen: number;
  totalAmount: number;
  type: 'company' | 'personal';
}

export interface RecurringPaymentToPersonResult {
  monthsSeen: number;
  avgAmount: number;
  transactions: { date: Date; amount: number }[];
}

/** A group of same-sender credit transactions, as produced by summarizeSourceGroup /
 * buildIncomeSourceBreakdown. */
export interface SourceGroup {
  name: string;
  type: string;
  count: number;
  total: number;
  firstDate: Date;
  lastDate: Date;
  txns: ParsedTxn[];
}

/** buildIncomeSourceBreakdown returns an array of groups with an extra `missingSalaryMonths`
 * property tacked on (matching the original's `groups.missingSalaryMonths = ...`). */
export type SourceGroups = SourceGroup[] & { missingSalaryMonths?: string[] | null };

export interface DuplicateSenderPair {
  nameA: string;
  nameB: string;
  key: string;
  shared: string[];
}

export interface ApplySenderDuplicateDecisionsResult {
  merged: Record<string, ParsedTxn[]>;
  pending: DuplicateSenderPair[];
}

/** One row of getTopConsistentSenders' result table — a sender ranked by how many distinct months
 * they've paid in, then by payment count, then by total amount. */
export interface TopConsistentSender {
  name: string;
  monthCount: number;
  count: number;
  total: number;
}

export interface TopConsistentSendersResult {
  list: TopConsistentSender[];
  pendingDuplicates: DuplicateSenderPair[];
}

export interface NarrationDecodePart {
  part: string;
  meaning: string;
}
