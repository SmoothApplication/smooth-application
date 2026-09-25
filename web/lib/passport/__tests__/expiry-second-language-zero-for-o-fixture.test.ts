// Ported from tests/expiry-second-language-zero-for-o-fixture.test.js (inline text fixtures, taken
// directly from the original test — it already drove the app via the window.__testExtractDates /
// window.__testParseMrzFields hooks with plain strings, no PDF/image fixture involved, so this ports
// 1:1 with no reconstruction needed).
//
// Real user report (shared as an actual passport photo, B50338594, expiring 2027-10-06 — same
// underlying report as expiry-printed-fallback-fixture.test.js, a later round of the same OCR
// trouble spot): even after that fix, the same applicant's passport STILL came back "Expires: not
// detected". extractDates()'s "DD MON / MON YY" pattern already tolerated the classic "0 read as O"
// OCR confusion in the FIRST month token, but the SECOND (bilingual) month token used a generic
// [a-z]{3,4} class that couldn't match a leading digit "0" at all. When BOTH "OCT"s in a real scan
// got OCR'd as "0CT", the whole date silently failed to match. Fixed by widening the second token's
// class to [a-z0][a-z]{2,3}.
import { extractDates } from '../dates';
import { parseMrzFields } from '../mrz';

test('extractDates finds "06 0CT / 0CT 27" even when both OCT tokens are OCR\'d as 0CT', () => {
  const corruptedText = "Date of Expiry / Date d'Expiration 06 0CT / 0CT 27";
  const dates = extractDates(corruptedText).map((d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
  expect(dates).toContain('2027-10-6');
});

test('a genuinely different second-language abbreviation (French JUIL) still works', () => {
  const frenchDates = extractDates('10 JUL / JUIL 34').map(
    (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`,
  );
  expect(frenchDates).toContain('2034-7-10');
});

test('parseMrzFields recovers the expiry date via the printed-text fallback when the MRZ expiry field is unreadable', () => {
  const mrzText = [
    "Date of Expiry / Date d'Expiration 06 0CT / 0CT 27",
    'P<NGAAFENI<<MARY<OLUWAFUNMILAYO<<<<<<<<<<<<<<<<',
    'B503385946NGA8803090F27X0062863023209853<<06',
  ].join('\n');
  const fields = parseMrzFields(mrzText);
  expect(fields).not.toBeNull();
  expect(fields?.expiryDate).not.toBeNull();
  const iso = `${fields?.expiryDate?.getFullYear()}-${(fields?.expiryDate?.getMonth() ?? 0) + 1}-${fields?.expiryDate?.getDate()}`;
  expect(iso).toBe('2027-10-6');
  expect(fields?.expiryDateSource).toBe('printed');
});
