// Task #432 (save/report-by-email redesign follow-up): a live audit against the original GitHub
// Pages site's "Advanced details" dropdown found this Next.js port never carried over the
// "Download spreadsheet" button (index.html's btnDownloadBreakdown handler, ~line 14571-14603) —
// a client-side export of the Income sources breakdown to a real .xlsx file, using the same
// "nothing leaves your device" privacy model as the rest of statement analysis (the file is built
// and downloaded entirely in-browser via SheetJS, never touching a server).
//
// Split into two pieces on purpose: buildIncomeBreakdownAoa (pure, testable — just data in, a
// spreadsheet-shaped array-of-arrays out) and the actual `XLSX.writeFile` trigger, which is a
// thin wrapper left to the UI layer (StatementDashboard.tsx) since it needs the browser's
// download machinery and the dynamically-imported 'xlsx' package, neither of which belong in a
// pure-logic module.
//
// Column set originally shipped as a deliberate subset of the original's seven columns, dropping
// its "Your explanation" column (a per-source free-text note the applicant could type against a
// flagged inflow, sourceExplanations/inflowExplanations in index.html). A live parity check against
// the original found that gap and confirmed it as a real, user-visible regression — restored below
// as an 8th column, sourced from the same per-source-group `explanations` map now collected in
// StatementDashboard.tsx (SourceGroupCard's "What was this for?" field), keyed the same way
// nameCorrections already is (the raw extracted group name). Everything else — Source, Type, Date,
// Amount, Reason (from narration), Narration — carries over unchanged, reusing the exact same
// extractNarrationReason() logic already used on-screen so the spreadsheet's Reason column never
// disagrees with what the applicant sees in the Income sources cards above it.
//
// Direct user report (screenshot of a downloaded file): two real gaps found by reading their own
// export back to them.
//   1. GRAND TOTAL was summing every group's subtotal, including reversal/self/interest/internal
//      groups — the applicant's own money bouncing back or moving between their own
//      accounts, never new income. The on-screen "Total income identified" card
//      (StatementDashboard's NON_INCOME_TYPES set) already excludes these; the spreadsheet's own
//      grand total disagreed with it, silently overstating income in the exact file a reviewer
//      might be shown. Now excludes the same types, so the two totals always agree.
//   2. Asked directly whether "Narration" (the raw bank text, which necessarily repeats the
//      sender's name already shown in "Source") should be shortened or dropped — the applicant's
//      own answer was to keep it as full raw text (real evidence a reviewer can cross-check
//      against the actual statement), but wanted it clearer that "Reason" is auto-extracted FROM
//      that Narration text, not an independently verified fact. Added as a one-line note row right
//      after the header rather than reworded into the header itself, so the note doesn't compete
//      for space with the column widths a spreadsheet reader actually uses.
import type { SourceGroups } from './types';
import { extractNarrationReason } from './classify';

export type SpreadsheetRow = (string | number)[];

// Same set StatementDashboard.tsx's totalIncomeIdentified excludes from "real" income — kept in
// sync deliberately (see this file's header comment) so the on-screen total and the downloaded
// spreadsheet's GRAND TOTAL can never silently disagree.
const NON_INCOME_TYPES = new Set(['reversal', 'self', 'interest', 'internal']);

/** Builds the array-of-arrays SheetJS needs (aoa_to_sheet), mirroring index.html's own aoa
 * construction exactly: one header row, an optional "possibly missing" warning row, then each
 * source group's transactions (source name/type shown once on the group's first row only),
 * a per-group subtotal, a blank spacer row, and a final grand-total row. */
export function buildIncomeBreakdownAoa(
  groups: SourceGroups,
  displayName: (rawName: string) => string,
  explanations: Record<string, string> = {}
): SpreadsheetRow[] {
  const aoa: SpreadsheetRow[] = [
    ['Source', 'Type', 'Date', 'Amount (NGN)', 'Reason (from narration)', 'Narration', 'Your explanation'],
    [
      "Note: \"Reason\" is auto-extracted from the raw \"Narration\" text in the next column - always double-check it against the original wording, especially if it looks off.",
    ],
  ];

  if (groups.missingSalaryMonths && groups.missingSalaryMonths.length > 0) {
    aoa.push([
      '⚠️ Possibly missing:',
      '',
      '',
      '',
      '',
      groups.missingSalaryMonths.map((m) => `${m} Salary`).join(', '),
      '',
    ]);
    aoa.push([]);
  }

  let grandTotal = 0;
  groups.forEach((g) => {
    // Direct user report: GRAND TOTAL used to sum every group's subtotal unconditionally, including
    // reversal/self/interest/internal groups - the applicant's own money bouncing back or moving
    // between their own accounts, never new income. That silently overstated income relative to the
    // on-screen "Total income identified" card, which already excludes these types. Now the two can
    // never disagree.
    if (!NON_INCOME_TYPES.has(g.type)) grandTotal += g.total;
    // Same exception as the on-screen render (SourceGroupCard/AnalysisTab) and the original's own
    // aoa builder — the auto-detected recurring-amount "Salary"/"Interest"/"Internal transfer"
    // buckets have no real sender name of their own (g.name is just a synthetic label), so nothing
    // is excluded as "the sender's own name" when extracting a Reason for those groups specifically.
    const nameWords =
      g.name && g.type !== 'salary' && g.type !== 'interest' && g.type !== 'internal'
        ? g.name.toUpperCase().split(/\s+/)
        : [];
    const explanation = explanations[g.name] || '';
    g.txns.forEach((t, i) => {
      const reason = extractNarrationReason(t.narration, nameWords);
      aoa.push([
        i === 0 ? displayName(g.name) : '',
        i === 0 ? g.type : '',
        t.date.toDateString(),
        Math.round(t.credit),
        reason || '',
        t.narration || '(none)',
        // Shown once on the group's first row, same "shown once" convention as Source/Type above —
        // one explanation applies to the whole source group, not per individual payment.
        i === 0 ? explanation : '',
      ]);
    });
    aoa.push(['', '', '', '', 'Subtotal for ' + displayName(g.name) + ':', g.total, '']);
    aoa.push([]);
  });

  aoa.push(['', '', '', '', 'GRAND TOTAL:', grandTotal, '']);
  return aoa;
}
