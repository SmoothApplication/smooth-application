// A real Word (.docx) version of the personal letter: centred bold name, contact lines, right-aligned
// date, bold numbered headings, bullet and numbered lists. Built in the browser (the `docx` package is
// loaded only when the button is pressed), nothing is sent anywhere.
import type { LetterPayload } from './types';

const fmt = (n: number) => '₦' + Math.round(n).toLocaleString('en-NG');

function salutationLines(countryName: string): string[] {
  return /united kingdom|^uk$/i.test(countryName)
    ? ['The Entry Clearance Officer,', 'UK Visas and Immigration,']
    : ['The Visa Officer,', `${countryName} Visa Section,`];
}

export async function buildLetterDocxBlob(payload: LetterPayload): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import('docx');
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const font = 'Times New Roman';
  const run = (text: string, opts: { bold?: boolean; size?: number } = {}) =>
    new TextRun({ text, font, bold: opts.bold, size: opts.size ?? 24 });
  const para = (text: string, after = 160) => new Paragraph({ children: [run(text)], spacing: { after } });
  const heading = (text: string) => new Paragraph({ children: [run(text, { bold: true })], spacing: { before: 200, after: 100 } });
  const item = (text: string, bullet: string) =>
    new Paragraph({ children: [run(`${bullet} ${text}`)], indent: { left: 540, hanging: 270 }, spacing: { after: 60 } });

  const kids: InstanceType<typeof Paragraph>[] = [];
  kids.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [run(payload.applicantName.toUpperCase(), { bold: true, size: 44 })] }));
  (payload.letterhead || []).forEach((l) => kids.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [run(l)] })));
  kids.push(new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 240, after: 240 }, children: [run(today)] }));
  salutationLines(payload.countryName).forEach((l) => kids.push(new Paragraph({ children: [run(l)] })));
  kids.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240 },
    children: [run(`LETTER OF INTRODUCTION AND SUPPORTING STATEMENT – ${payload.visaName.toUpperCase()} APPLICATION`, { bold: true })],
  }));
  kids.push(para('Dear Sir/Madam,'));
  kids.push(para(`I write to introduce myself and to provide supporting information for my ${payload.visaName} application. I set out below details of my employment, income, savings, travel plans and ties to Nigeria in support of my application.`));
  kids.push(heading('1. Employment'), para(payload.employmentParagraph));
  kids.push(heading('2. Income'));
  payload.incomeParagraphs.forEach((t) => kids.push(para(t)));
  payload.incomeRows.forEach((r) => kids.push(item(`${r.label}, ${r.dateLabel}: ${fmt(r.amount)}`, '•')));
  kids.push(heading('3. Savings and investments'), para(payload.savingsParagraph));
  payload.savingsRows.forEach((r, i) => kids.push(item(`${r.label} (${r.type}): ${fmt(r.balance)}`, `${i + 1}.`)));
  if (payload.savingsRows.length) kids.push(para(`Total savings and investments: ${fmt(payload.savingsTotal)}`));
  kids.push(heading('4. Purpose and plan of visit'), para(payload.purposeParagraph));
  kids.push(heading('5. Ties to Nigeria'), para(payload.tiesParagraph));
  kids.push(para('Thank you for your kind consideration of my application. I am happy to provide any further information or documentation that may be required, and I look forward to a favourable decision.'));
  kids.push(para('Yours faithfully,'), para(payload.applicantName));
  kids.push(heading('Enclosures:'));
  payload.enclosures.forEach((e, i) => kids.push(item(e, `${i + 1}.`)));

  const doc = new Document({
    creator: 'Smooth Application',
    title: 'Personal letter',
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1304, right: 1304 } } }, children: kids }],
  });
  return Packer.toBlob(doc);
}
