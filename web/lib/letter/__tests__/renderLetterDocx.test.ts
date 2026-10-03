import { buildLetterDocxBlob } from '../renderLetterDocx';
import type { LetterPayload } from '../types';

const payload = {
  generatedAtISO: '2026-10-03', countryName: 'United Kingdom', visaName: 'Standard Visitor visa', applicantName: 'A P',
  letterhead: ['Lagos'], employmentParagraph: 'Emp.', incomeParagraphs: ['Inc.'],
  incomeRows: [{ label: 'Salary', dateLabel: 'March 2026', amount: 650000, date: new Date('2026-03-18') }],
  savingsParagraph: 'Sav.', savingsRows: [{ label: 'Providus Bank', type: 'Current', balance: 2229805 }], savingsTotal: 2229805,
  purposeParagraph: 'Purpose.', tiesParagraph: 'Ties.', enclosures: ['Bank statement'],
} as unknown as LetterPayload;

it('builds a non-empty docx (zip) blob', async () => {
  const blob = await buildLetterDocxBlob(payload);
  const buf = Buffer.from(await blob.arrayBuffer());
  expect(buf.length).toBeGreaterThan(1000);
  expect(buf.subarray(0, 2).toString()).toBe('PK');
});
