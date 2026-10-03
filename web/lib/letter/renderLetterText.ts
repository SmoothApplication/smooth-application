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
  (payload.letterhead || []).forEach((l) => lines.push(l));
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
  if (payload.savingsRows.length) {
    lines.push('');
    payload.savingsRows.forEach((r, i) => lines.push(`  ${i + 1}. ${r.label} (${r.type}): ${fmt(r.balance)}`));
    lines.push(`  Total savings and investments: ${fmt(payload.savingsTotal)}`);
  }
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

/** Word-friendly version (HTML that Word/Pages/Google Docs open as a normal document), laid out like
 * the consultant's own letters: centred bold name, contact lines, right-aligned date, bold
 * numbered headings. No extra dependency; the figures are the same as the plain-text version. */
export function renderLetterHtml(payload: LetterPayload): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const p = (t: string) => `<p>${esc(t)}</p>`;
  const h = (t: string) => `<p><b>${esc(t)}</b></p>`;
  const out: string[] = [];
  out.push(`<p style="text-align:center;font-size:22pt"><b>${esc(payload.applicantName.toUpperCase())}</b></p>`);
  (payload.letterhead || []).forEach((l) => out.push(`<p style="text-align:center;margin:0">${esc(l)}</p>`));
  out.push(`<p style="text-align:right">${esc(today)}</p>`);
  out.push(salutationAddress(payload.countryName).split('\n').map((l) => `<p style="margin:0">${esc(l)}</p>`).join(''));
  out.push(`<p style="text-align:center"><b>${esc(`LETTER OF INTRODUCTION AND SUPPORTING STATEMENT – ${payload.visaName.toUpperCase()} APPLICATION`)}</b></p>`);
  out.push(p('Dear Sir/Madam,'));
  out.push(p(`I write to introduce myself and to provide supporting information for my ${payload.visaName} application. I set out below details of my employment, income, savings, travel plans and ties to Nigeria in support of my application.`));
  out.push(h('1. Employment'), p(payload.employmentParagraph));
  out.push(h('2. Income'));
  payload.incomeParagraphs.forEach((t) => out.push(p(t)));
  if (payload.incomeRows.length) {
    out.push('<ul>' + payload.incomeRows.map((r) => `<li>${esc(`${r.label}, ${r.dateLabel}: ${fmt(r.amount)}`)}</li>`).join('') + '</ul>');
  }
  out.push(h('3. Savings and investments'), p(payload.savingsParagraph));
  if (payload.savingsRows.length) {
    out.push('<ol>' + payload.savingsRows.map((r) => `<li>${esc(`${r.label} (${r.type}): ${fmt(r.balance)}`)}</li>`).join('') + '</ol>');
    out.push(p(`Total savings and investments: ${fmt(payload.savingsTotal)}`));
  }
  out.push(h('4. Purpose and plan of visit'), p(payload.purposeParagraph));
  out.push(h('5. Ties to Nigeria'), p(payload.tiesParagraph));
  out.push(p('Thank you for your kind consideration of my application. I am happy to provide any further information or documentation that may be required, and I look forward to a favourable decision.'));
  out.push(p('Yours faithfully,'), p(payload.applicantName));
  out.push(h('Enclosures:'));
  out.push('<ol>' + payload.enclosures.map((e) => `<li>${esc(e)}</li>`).join('') + '</ol>');
  return `<html><head><meta charset="utf-8"><title>Personal letter</title></head><body style="font-family:'Times New Roman',serif;font-size:12pt;line-height:1.4">${out.join('')}</body></html>`;
}
