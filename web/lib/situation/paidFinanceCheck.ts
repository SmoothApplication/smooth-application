// Task #416 (direct request, screenshot): for "Already paid & filled" applicants, "ask applicants
// to upload their filled UK form and their bank statements... the system now runs your bank
// statement through the income analysis check and checks it with what you filled in your finances
// of you filled UK form. This would confirm if your filled form fits your finances. If it does not
// fit ask the applicant to contact us. If it fits tell the applicant to the best of our knowledge
// the applicant is good to go."
//
// PURE LOGIC ONLY — no DOM, no file/OCR APIs. See SituationGate.tsx for how this is wired to the
// actual upload/OCR flow (extractLetterText.ts for the form, lib/statement's
// getLinesFromFile/parseStatementLinesWithFallback for the statement — reusing exactly the same
// on-device pipelines already built for the refusal-letter reading aid and the bank-statement
// checker, rather than a third separate one).
//
// Design choice, matching this app's established "reading aid, not a verdict" principle (see
// letterAnalysis.ts's header): the OCR'd form text is never trusted to auto-pick "the" declared
// funds figure — a visa form's page is full of numbers (reference numbers, dates, phone numbers)
// and guessing wrong about which one is the money figure would be worse than not guessing at all.
// Instead, extractMoneyFigures surfaces every currency-tagged amount it can find as read-aid
// suggestions; the applicant clicks one (or types their own) to confirm it. Only that confirmed
// number ever feeds into the fit check.
//
// Currency scope, deliberately narrow: this only compares Naira (₦) figures. The real UK visitor
// visa form has no single fixed "funds available" field to OCR — what an applicant can point to is
// usually a Naira amount from a cover letter, sponsor letter, or their own notes, compared against
// a Nigerian bank statement's Naira balance. If the form states a different currency, converting it
// automatically would mean picking an exchange rate this code has no reliable way to keep current —
// silently getting that wrong is worse than not attempting it, so the UI just asks the applicant to
// enter their own figure in Naira rather than offering a currency picker this module can't back
// with a trustworthy conversion.

import { ParsedTxn } from '@/lib/statement';

export interface MoneyFigure {
  /** The exact substring matched, e.g. "₦450,000" — shown to the applicant verbatim so they can
   * see it's really their own text, not a guess. */
  raw: string;
  /** Parsed numeric value, e.g. 450000. */
  value: number;
}

// Matches a ₦/NGN-tagged amount: the naira sign or the word "NGN"/"naira" immediately next to a
// number with optional thousands separators and up to 2 decimal places. Deliberately requires a
// currency marker rather than matching bare numbers — a filled visa form is full of unrelated
// digits (reference numbers, dates, phone numbers) that would otherwise flood this with noise. A
// bare "N" is deliberately NOT treated as a marker on its own — too easy to false-match reference
// codes like "N4021558" — only the unambiguous ₦ sign or the full "NGN"/"naira" word count.
const MONEY_PATTERN = /(?:₦|NGN)\s?([\d][\d,]*(?:\.\d{1,2})?)|([\d][\d,]*(?:\.\d{1,2})?)\s?(?:naira|NGN)\b/gi;

/** Pulls every Naira-tagged amount out of `text` (the OCR'd filled-form text), largest first,
 * deduplicated by value. Pure and exported for its own unit tests — see the module header for why
 * this only surfaces candidates rather than picking one. */
export function extractMoneyFigures(text: string): MoneyFigure[] {
  if (!text) return [];
  const seen = new Map<number, string>();
  let match: RegExpExecArray | null;
  MONEY_PATTERN.lastIndex = 0;
  while ((match = MONEY_PATTERN.exec(text))) {
    const digits = match[1] ?? match[2];
    if (!digits) continue;
    const value = Number(digits.replace(/,/g, ''));
    if (!Number.isFinite(value) || value < 1000) continue; // below this, almost certainly not a funds figure
    if (!seen.has(value)) seen.set(value, match[0].trim());
  }
  return Array.from(seen.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([value, raw]) => ({ value, raw }));
}

export interface StatementSummary {
  /** The balance on the most recent transaction in the statement(s) — the single figure closest to
   * "how much do you actually have right now". */
  latestBalance: number;
  /** Sum of every credit (money in) across the whole statement period — a rough "total income
   * seen", deliberately not excluding self-transfers/reversals/etc. the way the fuller income-
   * source breakdown does (StatementDashboard.tsx), since this check only needs a ballpark. */
  totalCredits: number;
  txnCount: number;
  earliestDate: Date | null;
  latestDate: Date | null;
}

/** Summarizes one or more already-parsed statements (concatenate ParsedTxn[] across files before
 * calling this — see SituationGate.tsx) into the handful of numbers this check needs. Pure. */
export function summarizeStatementTxns(txns: ParsedTxn[]): StatementSummary {
  if (!txns.length) {
    return { latestBalance: 0, totalCredits: 0, txnCount: 0, earliestDate: null, latestDate: null };
  }
  let totalCredits = 0;
  let earliestDate: Date | null = null;
  let latestDate: Date | null = null;
  let latestBalance = 0;
  for (const t of txns) {
    totalCredits += t.credit || 0;
    if (!(t.date instanceof Date) || Number.isNaN(t.date.getTime())) continue;
    if (!earliestDate || t.date < earliestDate) earliestDate = t.date;
    if (!latestDate || t.date >= latestDate) {
      latestDate = t.date;
      latestBalance = t.balance;
    }
  }
  return { latestBalance, totalCredits, txnCount: txns.length, earliestDate, latestDate };
}

export interface FinanceFitResult {
  fits: boolean;
  declaredAmount: number;
  latestBalance: number;
  /** latestBalance / declaredAmount — for showing "your statement covers ~82% of what you
   * declared" style messaging rather than just a flat yes/no. */
  ratio: number;
}

// A statement balance moves day to day even for someone with genuinely sufficient funds (rent
// paid, salary not yet in, etc.), so this doesn't require an exact match — only that the statement
// covers at least 90% of what was declared. Below that, the gap is wide enough that it's worth a
// second look rather than a false "you're good to go".
const FIT_TOLERANCE = 0.9;

/** Compares a declared funds figure (confirmed by the applicant, not auto-picked — see
 * extractMoneyFigures) against the statement's actual latest balance. Pure. */
export function checkDeclaredFundsFit(declaredAmount: number, summary: StatementSummary): FinanceFitResult {
  const ratio = declaredAmount > 0 ? summary.latestBalance / declaredAmount : 0;
  return {
    fits: declaredAmount > 0 && summary.latestBalance >= declaredAmount * FIT_TOLERANCE,
    declaredAmount,
    latestBalance: summary.latestBalance,
    ratio,
  };
}
