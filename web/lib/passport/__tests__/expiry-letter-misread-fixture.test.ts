// Ported from tests/expiry-letter-misread-fixture.test.js. The original test drove this through a
// real PDF (expiry-letter-misread-fixture.pdf) with the printed "Date of Expiry" text deliberately
// absent, so only the MRZ letter-fix machinery (not the printed-text fallback) can recover the date.
// Reconstructed here as an equivalent MRZ text block: expiry field "271O06" (a letter "O" where the
// digit "0" belongs, in the tens-of-month position of "271006" = 2027-10-06), with a valid composite
// checksum computed for the TRUE (post-fix) value -- exactly as a real passport's printed check digit
// would be, since the check digit itself isn't affected by the OCR misread of the date field next to
// it -- and no printed "Date of Expiry" text anywhere in the text, so this genuinely exercises
// fixMrzDateLetters() rather than the printed-text fallback.
//
// Real user report off a live scan: "Expires: not detected", MRZ checksum reading only 2/4 matched --
// root cause was a letter in the MRZ's digits-only expiry field. Since MRZ date fields are digits-only
// by spec (ICAO 9303), a letter there can only ever be a look-alike OCR misread, never a genuine value,
// so it's safe to normalize back to its look-alike digit before the checksum machinery runs at all.
import { validateMrz, parseMrzFields, mrzCheckSummary } from '../mrz';

const TEXT = [
  'REPUBLIC OF NIGERIA',
  'PASSPORT',
  'P<NGAOKORO<<CHIDI<<<<<<<<<<<<<<<<<<<<<<<<<<<',
  'B7654321<1NGA8505154M271O062<<<<<<<<<<<<<<04',
].join('\n');

test('fixMrzDateLetters normalizes the stray letter and the expiry checksum reads a clean 4/4 match', () => {
  const mrz = validateMrz(TEXT);
  expect(mrz).not.toBeNull();
  expect(mrz?.expiry).toBe('271006');
  expect(mrz?.checks.expiryDate).toBe(true);
  expect(mrz?.corrections.expiryDate).toBe(true);
  expect(mrzCheckSummary(mrz)).toBe('4/4 digit(s) matched');
});

test('parseMrzFields recovers the true 2027-10-06 expiry date straight from the MRZ (not a printed fallback)', () => {
  const fields = parseMrzFields(TEXT);
  expect(fields).not.toBeNull();
  expect(fields?.expiryDate).not.toBeNull();
  expect(fields?.expiryDate?.getFullYear()).toBe(2027);
  expect(fields?.expiryDate?.getMonth()).toBe(9); // October (0-indexed)
  expect(fields?.expiryDate?.getDate()).toBe(6);
  expect(fields?.expiryDateSource).toBe('mrz');
});
