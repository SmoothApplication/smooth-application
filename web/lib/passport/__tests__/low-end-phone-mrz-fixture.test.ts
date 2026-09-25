// Ported from tests/low-end-phone-mrz-fixture.test.js. The original PDF fixture reproduced a real
// low-end-phone photo where the MRZ line 1 padding tail OCR'd as stray characters instead of clean
// "<" filler, landing the line 9 characters short of 44 -- outside the old +/-6 length tolerance.
// Reconstructed here with an equivalent short/garbled line 1 (name "OKAFOR<<ADAEZE" followed by a
// garbled, non-alphabet-heavy tail, 35 characters total -- 9 short of 44, the same gap described in
// the original bug report) next to a valid, checksum-consistent line 2.
//
// Fixed three ways (see mrz.ts's normalizeMrzLine/findMrzLinesWithIndex comments): the candidate regex
// only requires a clean run right after the "P<XXX" prefix (not the whole line up front), the length
// tolerance widened from +/-6 to +/-10, and a stray character bleeding into a false "<<" boundary at
// the end of the given-name field gets stripped as a dangling single letter or noise run (see
// mrz-given-name-noise-fixture.test.ts for the more elaborate version of that same cleanup).
import { validateMrz, parseMrzFields, mrzCheckSummary } from '../mrz';

// The trailing "K<<«44K" is a stand-in for the original report's own garbled tail ("K<<« «44K"),
// landing the line at 35 characters (9 short of the ideal 44) instead of clean "<" padding.
const TEXT = [
  'REPUBLIC OF NIGERIA',
  'PASSPORT',
  'P<NGAOKAFOR<<ADAEZE<<<<<<<<<K<<«44K',
  'C1122334<4NGA9001011F3001019<<<<<<<<<<<<<<08',
].join('\n');

test('a short-but-otherwise-clean MRZ line (9 chars short of 44) is no longer dismissed outright', () => {
  const mrz = validateMrz(TEXT);
  expect(mrz).not.toBeNull();
  expect(mrzCheckSummary(mrz)).toBe('4/4 digit(s) matched');
});

test('the name auto-fills cleanly with no leftover OCR noise from the padding tail', () => {
  const fields = parseMrzFields(TEXT);
  expect(fields).not.toBeNull();
  expect(fields?.surname).toBe('OKAFOR');
  expect(fields?.given).toBe('ADAEZE');
  // parseMrzFields returns the raw MRZ-cased name; toTitleCase (already ported at
  // lib/statement/names.ts) is applied by the UI layer when auto-filling #f_name, out of scope here.
  expect(fields?.fullName).toBe('ADAEZE OKAFOR');
});
