// Ported from tests/dob-digit-misread-fixture.test.js. The original test drove this through a real PDF
// (dob-digit-misread-fixture.pdf) via the full upload -> OCR -> render pipeline. Reconstructed here as
// an equivalent MRZ + printed-text block: a birth-date MRZ field ("830903") that differs from the true
// value ("880903") by an OCR-confusable 8-for-3 swap at more than one plausible position, so
// findMrzFieldCorrectionCandidates finds multiple/ambiguous candidates and the composite check digit
// (deliberately unreadable here, same as it can genuinely be on a real bad scan) can't disambiguate
// them either -- exactly the "won't guess between them" case the original bug report exercises -- next
// to a printed "Date of Birth" line carrying the true value, which parseMrzFields should fall back to.
//
// Real user report: "Reading as 3/9/1938 instead of 3/9/1988" -- a birth-date field legitimately
// contains real digits, so a single ambiguous OCR misread can't be "corrected" on sight; the app falls
// back to the plain "Date of birth" text most passport bio pages also print, in a different font, on a
// different part of the page -- a second, independent OCR read.
import { validateMrz, parseMrzFields } from '../mrz';

const TEXT = [
  'REPUBLIC OF NIGERIA',
  'PASSPORT',
  'Date of Birth: 03/09/1988',
  'P<NGAADEBAYO<<TUNDE<<<<<<<<<<<<<<<<<<<<<<<<<',
  'A1234567<6NGA8309036M3001019<<<<<<<<<<<<<<0X',
].join('\n');

test('validateMrz reports the birth-date checksum as a mismatch it cannot confidently auto-correct', () => {
  const mrz = validateMrz(TEXT);
  expect(mrz).not.toBeNull();
  expect(mrz?.checks.birthDate).toBe(false);
  // The digit-swap correction machinery deliberately backs off here (ambiguous candidates, and the
  // composite check digit itself unreadable on this scan) rather than silently guessing.
  expect(mrz?.corrections.birthDate).toBe(false);
});

test('parseMrzFields recovers the true 1988 birth year from the printed "Date of Birth" fallback, not the misread 1938', () => {
  const fields = parseMrzFields(TEXT);
  expect(fields).not.toBeNull();
  expect(fields?.birthDate).not.toBeNull();
  expect(fields?.birthDate?.getFullYear()).toBe(1988);
  expect(fields?.birthDate?.getMonth()).toBe(8); // September (0-indexed)
  expect(fields?.birthDate?.getDate()).toBe(3);
  expect(fields?.birthDateSource).toBe('printed');
});
