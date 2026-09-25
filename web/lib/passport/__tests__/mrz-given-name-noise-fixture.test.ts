// Ported from tests/mrz-given-name-noise-fixture.test.js. The original PDF fixture reproduced a real
// client photo where the MRZ auto-fill produced "Faith Folasade K Klllllllll Bello" instead of "Faith
// Folasade Bello" -- stray OCR noise from the name field's trailing "<" padding survived as two extra
// tokens instead of clean filler. Reconstructed here with an equivalent given-name field carrying the
// same two noise-token shapes (a bare single letter, and a run of 3+ repeats of one letter) mid-field,
// not just at the very end.
//
// Fixed in parseMrzFields(): drops, anywhere in the given-name field, any bare single-letter word, and
// any word matching an optional odd leading character followed by 3+ repeats of the same letter --
// patterns a genuine given name never legitimately contains, but misread filler reliably produces.
import { parseMrzFields } from '../mrz';

const TEXT = [
  'P<NGAADEYEMI<<TEMITOPE<GRACE<K<KLLLLLLLLLL',
  'C1122334<4NGA9001011F3001019<<<<<<<<<<<<<<08',
].join('\n');

test('parseMrzFields drops both the bare-letter and repeated-letter noise tokens from the given name', () => {
  const fields = parseMrzFields(TEXT);
  expect(fields).not.toBeNull();
  expect(fields?.surname).toBe('ADEYEMI');
  expect(fields?.given).toBe('TEMITOPE GRACE');
  expect(fields?.given).not.toMatch(/\bK\b/);
  expect(fields?.given).not.toMatch(/L{3,}/i);
  // parseMrzFields returns the raw MRZ-cased name; the UI layer applies toTitleCase (ported at
  // lib/statement/names.ts) before writing it into #f_name / #pv_name, out of scope for this module.
  expect(fields?.fullName).toBe('TEMITOPE GRACE ADEYEMI');
});
