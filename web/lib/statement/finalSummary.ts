// Direct instruction, verbatim: "on a comprehensive, not clumsy list, when you are done, compress
// all these lists and give it in a proper report, a full report and a summarized, concise report,
// bulleted. This, your financial report is ready, your opening balance good, closing balance good,
// monthly expenses good, total overall inflow good, whichever is bad, bad. You need to pay
// attention to expired passport... your opening balance... your closing balance... no recurring
// income as salary. Old salary and recurring income in high esteem." Everything this checks already
// exists elsewhere in the Report tab as separate cards (Financial summary table, income source
// breakdown, statement currency warning, unexplained-inflow groups) — this module is the final
// compression step: pull the already-computed verdicts into one short bulleted list, plus a
// separate "needs attention" list for anything that doesn't fit a clean good/bad line.
//
// Deliberately does NOT re-derive any figure itself — every input here is a number or verdict the
// rest of this engine (cashFlow.ts, financial.ts, statementCurrency.ts, classify.ts) already
// computed and the UI already displays elsewhere. This just decides the wording and ordering for
// the compressed view.
export type SummaryVerdict = 'good' | 'bad';

export interface FinalSummaryLine {
  label: string;
  verdict: SummaryVerdict;
  detail: string;
}

export interface FinalSummaryResult {
  lines: FinalSummaryLine[];
  /** Count of 'good' lines, for an "N of M good" style overall read. */
  goodCount: number;
  totalCount: number;
  /** Short, plain-language items that need the applicant's attention but aren't a clean
   * good/bad line on their own (e.g. "your statement is not a current 6 months", "expired
   * passport", "N inflow patterns still need an explanation"). */
  attentionFlags: string[];
}

export interface FinalSummaryInput {
  openingBalance: number;
  closingBalance: number;
  totalInflow: number;
  totalOutflow: number;
  recommendedFundsFloor: number;
  /** True when at least one income-source group was classified as 'salary' (a recognisable,
   * traditional payroll credit). */
  hasSalaryIncome: boolean;
  /** True when no group is classified 'salary', but at least one sender still pays consistently
   * (3+ distinct months) — recurring income that just isn't traditional salary. Per the direct
   * instruction, this is framed as a strength ("recurring income in high esteem"), not a gap. */
  hasOtherRecurringIncome: boolean;
  /** From computeStatementCurrency — non-empty when the statement isn't a current, genuine
   * 6-month window. Surfaced as an attention flag, never as a bad line (it's a warning, not a
   * pass/fail check — see statementCurrency.ts). */
  statementCurrencyIssues: ('stale' | 'short_span')[];
  /** Count of distinct (sender, month, amount) groups still missing an explanation — see
   * groupFlaggedInflows in classify.ts. */
  unexplainedGroupCount: number;
  /** Optional: true when the applicant's passport is expired or expires before their planned
   * travel. Left optional/undefined because passport data lives outside lib/statement — callers
   * that have it (a page combining both checks) can pass it through; callers that don't simply
   * omit this flag rather than the summary silently guessing. */
  passportExpired?: boolean;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export function buildFinalSummary(input: FinalSummaryInput): FinalSummaryResult {
  const {
    openingBalance,
    closingBalance,
    totalInflow,
    totalOutflow,
    recommendedFundsFloor,
    hasSalaryIncome,
    hasOtherRecurringIncome,
    statementCurrencyIssues,
    unexplainedGroupCount,
    passportExpired,
  } = input;

  const lines: FinalSummaryLine[] = [
    {
      label: 'Opening balance',
      verdict: openingBalance > 50000 ? 'good' : 'bad',
      detail: fmt(openingBalance),
    },
    {
      label: 'Closing balance',
      verdict: closingBalance >= recommendedFundsFloor ? 'good' : 'bad',
      detail: `${fmt(closingBalance)}${closingBalance < recommendedFundsFloor ? ` — below the ${fmt(recommendedFundsFloor)} a reviewer typically expects` : ''}`,
    },
    {
      label: 'Total inflow',
      verdict: totalInflow > 0 ? 'good' : 'bad',
      detail: fmt(totalInflow),
    },
    {
      label: 'Monthly expenses (total outflow)',
      verdict: totalOutflow > totalInflow ? 'bad' : 'good',
      detail: `${fmt(totalOutflow)}${totalOutflow > totalInflow ? ' — more than your total inflow' : ''}`,
    },
  ];

  // "No recurring income as salary" is the concern; "recurring income in high esteem" is a
  // strength that should read as GOOD, not as a lesser version of salary.
  if (hasSalaryIncome) {
    lines.push({ label: 'Recurring salary income', verdict: 'good', detail: 'Identified on this statement' });
  } else if (hasOtherRecurringIncome) {
    lines.push({
      label: 'Recurring income',
      verdict: 'good',
      detail: 'No traditional salary, but consistent recurring income from another source was found — worth highlighting as a strength',
    });
  } else {
    lines.push({ label: 'Recurring income', verdict: 'bad', detail: 'No recurring salary or other consistent income was identified' });
  }

  const goodCount = lines.filter((l) => l.verdict === 'good').length;

  const attentionFlags: string[] = [];
  if (statementCurrencyIssues.length > 0) {
    attentionFlags.push(
      statementCurrencyIssues.includes('stale') && statementCurrencyIssues.includes('short_span')
        ? "This statement isn't a current, full 6-month window (both stale and short) — still processed, but worth a fresher upload if you have one"
        : statementCurrencyIssues.includes('stale')
        ? 'This statement is not recent — its most recent transaction is dated a while back'
        : "This statement doesn't yet cover a full 6-month span"
    );
  }
  if (unexplainedGroupCount > 0) {
    attentionFlags.push(
      `${unexplainedGroupCount} inflow pattern${unexplainedGroupCount === 1 ? '' : 's'} still need${
        unexplainedGroupCount === 1 ? 's' : ''
      } an explanation`
    );
  }
  if (passportExpired) {
    attentionFlags.push('Your passport is expired, or expires before your planned travel');
  }

  return { lines, goodCount, totalCount: lines.length, attentionFlags };
}
