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
// Column set is a deliberate subset of the original's seven columns. index.html additionally had
// a "Your explanation" column, sourced from a per-inflow/per-source free-text note the applicant
// could type against a flagged inflow (sourceExplanations/inflowExplanations) — that per-inflow
// annotation UI was never part of this port's simpler two-tab (Analysis/Report) dashboard design,
// so there is nothing here to put in that column. Everything else — Source, Type, Date, Amount,
// Reason (from narration), Narration — carries over unchanged, reusing the exact same
// extractNarrationReason() logic already used on-screen so the spreadsheet's Reason column never
// disagrees with what the applicant sees in the Income sources cards above it.

import type { SourceGroups } from './types';
import { extractNarrationReason } from './classify';

export type SpreadsheetRow = (string | number)[];

/** Builds the array-of-arrays SheetJS needs (aoa_to_sheet), mirroring index.html's own aoa
 * construction exactly: one header row, an optional "possibly missing" warning row, then each
 * source group's transactions (source name/type shown once on the group's first row only),
 * a per-group subtotal, a blank spacer row, and a final grand-total row. */
export function buildIncomeBreakdownAoa(
  groups: SourceGroups,
  displayName: (rawName: string) => string
): SpreadsheetRow[] {
  const aoa: SpreadsheetRow[] = [
    ['Source', 'Type', 'Date', 'Amount (NGN)', 'Reason (from narration)', 'Narration'],
  ];

  if (groups.missingSalaryMonths && groups.missingSalaryMonths.length > 0) {
    aoa.push([
      '⚠️ Possibly missing:',
      '',
      '',
      '',
      '',
      groups.missingSalaryMonths.map((m) => `${m} Salary`).join(', '),
    ]);
    aoa.push([]);
  }

  let grandTotal = 0;
  groups.forEach((g) => {
    grandTotal += g.total;
    // Same exception as the on-screen render (SourceGroupCard/AnalysisTab) and the original's own
    // aoa builder — the auto-detected recurring-amount "Salary"/"Interest"/"Internal transfer"
    // buckets have no real sender name of their own (g.name is just a synthetic label), so nothing
    // is excluded as "the sender's own name" when extracting a Reason for those groups specifically.
    const nameWords =
      g.name && g.type !== 'salary' && g.type !== 'interest' && g.type !== 'internal'
        ? g.name.toUpperCase().split(/\s+/)
        : [];
    g.txns.forEach((t, i) => {
      const reason = extractNarrationReason(t.narration, nameWords);
      aoa.push([
        i === 0 ? displayName(g.name) : '',
        i === 0 ? g.type : '',
        t.date.toDateString(),
        Math.round(t.credit),
        reason || '',
        t.narration || '(none)',
      ]);
    });
    aoa.push(['', '', '', '', 'Subtotal for ' + displayName(g.name) + ':', g.total]);
    aoa.push([]);
  });

  aoa.push(['', '', '', '', 'GRAND TOTAL:', grandTotal]);
  return aoa;
}
