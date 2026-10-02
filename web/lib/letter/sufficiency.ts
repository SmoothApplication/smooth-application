// See types.ts for why this exists. Checked BEFORE buildLetterPayload ever runs (direct instruction:
// "before you create it, let it tell you that it is insufficient") — every gap here is something the
// applicant can go fix on an earlier session, so each message names the field AND where to go enter
// it, not just that something's missing.
import { LetterInput, LetterSufficiencyResult } from './types';

export function checkLetterSufficiency(input: LetterInput): LetterSufficiencyResult {
  const missing: string[] = [];

  if (!input.applicantName || !input.applicantName.trim()) {
    missing.push('Your full name — detected automatically once a bank statement is uploaded, or type it in on the Report tab');
  }

  if (!input.employed && !input.selfEmployed) {
    missing.push("Your employment status — answer it in the 'Your responsibilities' session");
  } else if (input.employed && !input.employerName.trim()) {
    missing.push("Your employer's name — enter it on this Report tab (Employer/business name check)");
  } else if (input.selfEmployed && !input.businessName.trim()) {
    missing.push('Your business name — enter it on this Report tab (Employer/business name check)');
  }

  const statementsWithData = input.statementSummaries.filter((s) => s.txnCount > 0);
  if (!statementsWithData.length) {
    missing.push('A bank statement with transactions — upload one on the Bank statement check session');
  } else {
    const hasIncome = input.groups.some((g) => g.type !== 'self' && g.type !== 'reversal' && g.type !== 'other');
    if (!hasIncome) {
      missing.push('At least one recognisable income source in your bank statement — no salary or payment pattern has been identified yet');
    }
    if (input.closingBalance <= 0) {
      missing.push('A positive closing balance on your bank statement');
    }
  }

  if (!input.answers.purpose) {
    missing.push("Your purpose of visit — answer it in the 'Your responsibilities' session");
  }

  if (!input.financialInputs?.travelDate || !input.financialInputs?.returnDate) {
    missing.push('Your travel dates — enter them in the Financial calculator');
  }

  if (!input.answers.livingState) {
    missing.push("Your home address — answer it in the 'Your responsibilities' session");
  }

  return { sufficient: missing.length === 0, missing };
}
