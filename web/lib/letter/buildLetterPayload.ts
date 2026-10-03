// Pure and synchronous — every input is already-computed plain data (Answers/SourceGroups/
// StatementSummary[]/FinancialInputs), so this has no localStorage/fetch of its own and is fully
// unit-testable (see __tests__/buildLetterPayload.test.ts). Only ever called once
// checkLetterSufficiency(input).sufficient is true — callers should not render a payload built from
// insufficient data.
import { LetterInput, LetterPayload, LetterIncomeRow } from './types';
import { extractRemitaPurpose } from '@/lib/statement/remitaReason';

const EXCLUDED_INCOME_TYPES = new Set(['self', 'reversal', 'interest', 'internal', 'other']);
// Capped so an applicant with months of frequent small business inflows doesn't produce an
// unreadably long table — the letter states the total either way, this just bounds the itemized
// list to the most recent, most legible rows.
const MAX_INCOME_ROWS = 14;

function fmt(n: number): string {
  return '₦' + Math.round(n).toLocaleString('en-NG');
}

function fmtDate(d: Date): string {
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtDateStr(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return fmtDate(d);
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function buildLetterPayload(input: LetterInput): LetterPayload {
  const { answers, financialInputs } = input;

  // --- Employment ---
  const employmentBits: string[] = [];
  if (input.employed) {
    employmentBits.push(`I am currently employed${input.employerName ? ` with ${input.employerName}` : ''}.`);
  }
  if (input.selfEmployed) {
    employmentBits.push(`I am self-employed${input.businessName ? `, operating ${input.businessName}` : ''}.`);
  }
  const employmentParagraph = employmentBits.join(' ');

  // --- Income ---
  const salaryGroup = input.groups.find((g) => g.type === 'salary');
  const namedGroups = input.groups.filter((g) => !EXCLUDED_INCOME_TYPES.has(g.type) && g.type !== 'salary');

  const incomeParagraphs: string[] = [];
  if (salaryGroup) {
    const avgMonthly = salaryGroup.count > 0 ? salaryGroup.total / salaryGroup.count : 0;
    incomeParagraphs.push(
      `My bank statement shows a regular monthly salary${input.employerName ? ` from ${input.employerName}` : ''}, averaging ${fmt(avgMonthly)}, credited ${salaryGroup.count} time${
        salaryGroup.count === 1 ? '' : 's'
      } between ${fmtDate(salaryGroup.firstDate)} and ${fmtDate(salaryGroup.lastDate)} (total ${fmt(salaryGroup.total)}).`
    );
  }
  if (namedGroups.length) {
    incomeParagraphs.push(
      'In addition to my salary, the following payments (allowances, bonuses and other income) have been credited to my account, as shown in my bank statement:'
    );
  } else if (!salaryGroup) {
    incomeParagraphs.push(
      'My bank statement shows consistent income credited to my account over the period covered, as detailed below.'
    );
  }

  const allNamedRows = namedGroups
    .flatMap((g) => g.txns.filter((t) => t.credit > 0).map((t) => ({ label: extractRemitaPurpose(t.narration) ? `${g.name} - ${extractRemitaPurpose(t.narration)}` : g.name, dateLabel: fmtDate(t.date), amount: t.credit, date: t.date })))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const incomeRows: LetterIncomeRow[] = allNamedRows
    .slice(-MAX_INCOME_ROWS)
    .map(({ label, dateLabel, amount }) => ({ label, dateLabel, amount }));
  if (allNamedRows.length > MAX_INCOME_ROWS) {
    incomeParagraphs.push(
      `(Showing the most recent ${MAX_INCOME_ROWS} of ${allNamedRows.length} identified payments — the full list is in the attached bank statement.)`
    );
  }

  // --- Savings and investments ---
  const statementsWithData = input.statementSummaries.filter((s) => s.txnCount > 0);
  const savingsParts: string[] = [];
  if (statementsWithData.length) {
    const labels = statementsWithData.map((s) => s.label).join(' and ');
    savingsParts.push(
      `I maintain ${statementsWithData.length === 1 ? 'a bank account' : 'bank accounts'} (${labels}). My bank statement${
        statementsWithData.length === 1 ? '' : 's'
      }, enclosed with this application, show${statementsWithData.length === 1 ? 's' : ''} total credits of ${fmt(
        input.totalInflow
      )} and total debits of ${fmt(input.totalOutflow)}, with a combined closing balance of ${fmt(input.closingBalance)}.`
    );
  }
  savingsParts.push(
    'This demonstrates both my regular income and my capacity to fund my planned visit without recourse to public funds or third-party sponsorship.'
  );
  const savingsParagraphFinal = savingsParts.join(' ');

  // --- Purpose and plan of visit ---
  const purposeLabel = answers.purpose ? cap(answers.purpose) : 'tourism';
  const travelDate = financialInputs?.travelDate ? fmtDateStr(financialInputs.travelDate) : '';
  const returnDate = financialInputs?.returnDate ? fmtDateStr(financialInputs.returnDate) : '';
  const purposeParagraph =
    travelDate && returnDate
      ? `I intend to travel to ${input.countryName} for ${purposeLabel}, from ${travelDate} to ${returnDate}. I will meet the full cost of this trip from my own income and savings as set out above, and no one else will be paying towards the cost of this visit.`
      : `I intend to travel to ${input.countryName} for ${purposeLabel}. I will meet the full cost of this trip from my own income and savings as set out above, and no one else will be paying towards the cost of this visit.`;

  // --- Ties to Nigeria ---
  const addressBits = [answers.addressNumber, answers.addressName, answers.livingLga, answers.livingState].filter(Boolean).join(', ');
  const tiesBits: string[] = [];
  if (addressBits) tiesBits.push(`I live${answers.hasHost ? '' : ' with my family'} at ${addressBits}.`);
  if (input.employed || input.selfEmployed) {
    tiesBits.push(
      input.employed
        ? `I hold a substantive position${input.employerName ? ` with ${input.employerName}` : ''}, to which I am required to return at the end of my visit.`
        : `I run my own business${input.businessName ? `, ${input.businessName}` : ''}, which requires my continued presence in Nigeria.`
    );
  }
  if (answers.agedParents && (answers.fatherName || answers.motherName)) {
    tiesBits.push('I also support aged parents who remain in Nigeria.');
  }
  tiesBits.push('I have no intention of overstaying my visa and will return to Nigeria at the end of my visit.');
  const tiesParagraph = tiesBits.join(' ');

  // Mirrors the document list on the UKVI/VFS "Document checklist" so the letter and the form agree.
  const enclosures: string[] = [];
  enclosures.push('Valid international passport (bio-data page) and previous passports, if any');
  statementsWithData.forEach((s) => enclosures.push(`Bank statement (stamped by the bank) - ${s.label}`));
  if (input.employed) {
    enclosures.push('Employment letter and leave approval from my employer');
    enclosures.push('Recent payslips');
  }
  if (input.selfEmployed) enclosures.push('Evidence of business ownership (registration certificate, tax records)');
  enclosures.push('Flight reservation / travel itinerary');
  enclosures.push('Accommodation details for the visit');
  enclosures.push('Proof of ties to Nigeria (for example tenancy or property documents, family documents)');

  const letterhead = [addressBits, input.email, input.phone].filter((x): x is string => !!x && !!x.trim());

  return {
    letterhead,
    generatedAtISO: new Date().toISOString(),
    countryName: input.countryName,
    visaName: input.visaName,
    applicantName: input.applicantName,
    employmentParagraph,
    incomeParagraphs,
    incomeRows,
    savingsParagraph: savingsParagraphFinal,
    purposeParagraph,
    tiesParagraph,
    enclosures,
  };
}
