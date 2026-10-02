// Turns a LetterPayload into the final plain-text letter — same 5-section structure (Employment /
// Income / Savings and investments / Purpose and plan of visit / Ties to Nigeria) plus a closing
// and Enclosures list as a real, submission-shaped visa consultant's cover letter would read. Kept
// as plain text (not HTML/docx) so it can be copied straight into whatever the consultant already
// uses, and so this stays trivially unit-testable with no rendering dependency.
import { LetterPayload } from './types';

function fmt(n: number): string {
  return '₦' + Math.round(n).toLocaleString('en-NG');
}

function salutationAddress(countryName: string): string {
  if (/united kingdom|^uk$/i.test(countryName)) {
    return 'The Entry Clearance Officer,\nUK Visas and Immigration,';
  }
  return `The Visa Officer,\n${countryName} Visa Section,`;
}

export function renderLetterText(payload: LetterPayload): string {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const lines: string[] = [];

  lines.push(payload.applicantName.toUpperCase());
  lines.push('');
  lines.push(today);
  lines.push('');
  lines.push(salutationAddress(payload.countryName));
  lines.push('');
  lines.push(`LETTER OF INTRODUCTION AND SUPPORTING STATEMENT – ${payload.visaName.toUpperCase()} APPLICATION`);
  lines.push('');
  lines.push('Dear Sir/Madam,');
  lines.push('');
  lines.push(
    `I write to introduce myself and to provide supporting information for my ${payload.visaName} application. I set out below details of my employment, income, savings, travel plans and ties to Nigeria in support of my application.`
  );
  lines.push('');

  lines.push('1. Employment');
  lines.push(payload.employmentParagraph);
  lines.push('');

  lines.push('2. Income');
  payload.incomeParagraphs.forEach((p) => {
    lines.push(p);
  });
  if (payload.incomeRows.length) {
    lines.push('');
    payload.incomeRows.forEach((row) => {
      lines.push(`  - ${row.label}, ${row.dateLabel}: ${fmt(row.amount)}`);
    });
  }
  lines.push('');

  lines.push('3. Savings and investments');
  lines.push(payload.savingsParagraph);
  lines.push('');

  lines.push('4. Purpose and plan of visit');
  lines.push(payload.purposeParagraph);
  lines.push('');

  lines.push('5. Ties to Nigeria');
  lines.push(payload.tiesParagraph);
  lines.push('');

  lines.push(
    'Thank you for your kind consideration of my application. I am happy to provide any further information or documentation that may be required, and I look forward to a favourable decision.'
  );
  lines.push('');
  lines.push('Yours faithfully,');
  lines.push('');
  lines.push(payload.applicantName);
  lines.push('');
  lines.push('Enclosures:');
  payload.enclosures.forEach((e, i) => lines.push(`${i + 1}. ${e}`));

  return lines.join('\n');
}
