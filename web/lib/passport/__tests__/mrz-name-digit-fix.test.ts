// Ported from tests/mrz-name-digit-fix.test.js. The original test drove this through a real PDF text
// layer (mrz-name-digit-fixture.pdf) embedding a surname with a digit "0" in place of the letter "O"
// ("IBIDAP0" instead of "IBIDAPO"). Reconstructed here as an equivalent TD3 MRZ text block — the same
// shape a PDF text-layer extraction or OCR pass would hand to parseMrzFields — with a valid checksum
// line 2 computed for a fictional passport number/dates, since only the name-digit-fix code path is
// under test, not the checksum machinery.
//
// Real user report: "After the name is generated from the passport, the o in [name] read as zero '0'."
// Per ICAO Doc 9303, the MRZ name field is letters and "<" filler ONLY — a digit can never legitimately
// appear there, so any digit found is always a misread and safe to auto-correct via fixMrzNameDigits.
import { parseMrzFields } from '../mrz';

test('fixMrzNameDigits (via parseMrzFields) turns a digit "0" back into the letter "O" in the surname', () => {
  const text = [
    'REPUBLIC OF NIGERIA',
    'PASSPORT',
    'P<NGAIBIDAP0<<GRACE<<<<<<<<<<<<<<<<<<<<<<<<<',
    'A1234567<6NGA8501019F3001019<<<<<<<<<<<<<<00',
  ].join('\n');

  const fields = parseMrzFields(text);
  expect(fields).not.toBeNull();
  expect(fields?.surname).toBe('IBIDAPO');
  expect(fields?.surname).not.toMatch(/IBIDAP0\b/);
  expect(fields?.given).toBe('GRACE');
  // parseMrzFields returns the raw MRZ-cased name; the UI layer applies toTitleCase before writing it
  // into the applicant's name field (out of scope for this pure-logic module).
  expect(fields?.fullName).toBe('GRACE IBIDAPO');
});
