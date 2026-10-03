// Direct request: "I want you to create a personal letter once the person gives every document
// that is needed... before you create it, let it tell you that it is insufficient." This mirrors a
// real supporting-statement letter a visa consultant writes once an applicant's documents are all
// in — the same 5-section structure (Employment / Income / Savings and investments / Purpose and
// plan of visit / Ties to Nigeria) plus an Enclosures list, verified directly from this app's own
// already-computed data (bank-statement income groups, financial-calculator trip dates, "Your
// responsibilities" answers) rather than re-asking the applicant to type any of it again.
//
// Deliberately generic across all 8 supported countries, not UK-only — countryName/visaName are
// inputs, and renderLetterText.ts only special-cases the UK's "Entry Clearance Officer" salutation
// (every other country gets a generic "The Visa Officer" address).
import { SourceGroups } from '@/lib/statement/types';
import { StatementSummary } from '@/lib/statement/combined';
import { Answers } from '@/lib/checklist/types';
import { FinancialInputs } from '@/lib/checklist/financial';

/** Everything the letter engine needs — assembled by the caller (ReportTab.tsx) from state/props it
 * already has in scope. Pure data, no localStorage/fetch of its own, so both the sufficiency check
 * and the payload builder stay fully unit-testable. */
export interface LetterInput {
  countryName: string;
  visaName: string;
  applicantName: string;
  answers: Answers;
  employed: boolean;
  selfEmployed: boolean;
  employerName: string;
  businessName: string;
  /** Already-classified income-source groups for this applicant's statement(s) — see
   * buildIncomeSourceBreakdown in lib/statement/classify.ts. The letter never re-derives this. */
  groups: SourceGroups;
  statementSummaries: StatementSummary[];
  totalInflow: number;
  totalOutflow: number;
  openingBalance: number;
  closingBalance: number;
  financialInputs: FinancialInputs | null;
  /** Optional letterhead contact details (typed once in the letter panel). */
  phone?: string;
  email?: string;
  /** Optional personal detail typed once in the letter panel. */
  jobTitle?: string;
  startedWhen?: string;
  jobDescription?: string;
  previousEmployment?: string;
  plans?: string;
  otherSavings?: OtherSavingsRow[];
  /** Read from an uploaded payslip (optional). */
  payslip?: { month: string; gross: number; net: number };
}

export interface OtherSavingsRow {
  bank: string;
  type: string;
  balance: number;
}

export interface LetterSufficiencyResult {
  sufficient: boolean;
  /** Plain-language, one-per-gap list — shown to the applicant before any letter is generated, so
   * "insufficient" always comes with exactly what to add next rather than a bare refusal. */
  missing: string[];
}

export interface LetterIncomeRow {
  label: string;
  dateLabel: string;
  amount: number;
}

export interface LetterPayload {
  generatedAtISO: string;
  countryName: string;
  visaName: string;
  applicantName: string;
  /** Address / email / phone lines printed under the name, like a real cover letter. */
  letterhead: string[];
  employmentParagraph: string;
  incomeParagraphs: string[];
  incomeRows: LetterIncomeRow[];
  savingsParagraph: string;
  /** Account-by-account list (statement accounts plus any others typed in). Empty when only one account. */
  savingsRows: { label: string; type: string; balance: number }[];
  savingsTotal: number;
  purposeParagraph: string;
  tiesParagraph: string;
  enclosures: string[];
}
