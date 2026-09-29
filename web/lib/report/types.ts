// Task #422/#426+ ("continue with the save/report-by-email redesign" — task #421 confirmed the 4
// design decisions via AskUserQuestion: placement = page content not sidebar on ALL pages, PDF
// delivery = email only, JSON export stays an instant no-email download, report contents = full
// checklist summary). This is the plain-data shape a "full checklist summary" boils down to —
// responsibilities answers, document checklist status, financial readiness figures, and bank
// statement summary (one or two accounts, see lib/statement/combined.ts) — built once here so both
// the PDF renderer (renderReportPdf.ts) and any future consumer (an on-screen preview, say) read
// from the same shape rather than each re-deriving it from raw Answers/FinancialInputs/ParsedTxn[].
export interface ReportDocsSummary {
  percent: number;
  statusLabel: string;
  totalRequired: number;
  totalChecked: number;
  missing: { id: string; label: string }[];
}

export interface ReportAnswerLine {
  label: string;
  value: string;
}

export interface ReportFinancialSummary {
  totalCost: number;
  recommendedFunds: number;
  totalFunds: number;
  shortfall: number;
  fundsReady: boolean;
  readinessPercent: number;
  readinessCapped: boolean;
  timingRealityCheck: string;
}

export interface ReportStatementLine {
  label: string;
  closingBalance: number;
  firstDateISO: string | null;
  lastDateISO: string | null;
  txnCount: number;
}

export interface ReportStatementSummary {
  statements: ReportStatementLine[];
  combinedClosingBalance: number;
  earliestDateISO: string | null;
  latestDateISO: string | null;
}

export interface ReportPayload {
  generatedAtISO: string;
  countryCode: string;
  countryName: string;
  visaName: string;
  docs: ReportDocsSummary;
  /** Only fields the applicant actually gave a meaningful answer to — see
   * buildResponsibilitiesSummary in buildReportPayload.ts for exactly what counts as meaningful.
   * Deliberately not a dump of all ~40 Answers fields: most are empty/false for any given
   * applicant, and a report full of "No"/blank lines would bury the handful that actually matter. */
  responsibilities: ReportAnswerLine[];
  /** null when nothing has been entered in the financial calculator yet — the report should say so
   * rather than showing an all-zero block. */
  financial: ReportFinancialSummary | null;
  /** null when no statement (of either slot) has any parsed transactions yet. */
  statement: ReportStatementSummary | null;
}
