// Ported from tests/expiry-printed-fallback-fixture.test.js. The original was a "Deterministic PDF
// text-layer fixture (not a live OCR image)" per its own comment, using an entirely fictional identity
// -- reconstructed here as the equivalent plain-text MRZ + printed-text block it would have produced:
// a genuinely non-digit character inside the MRZ's expiry field (breaking parsing outright, not just
// the checksum) alongside an intact, legible "Date of Expiry / Date d'Expiration 06 OCT / OCT 27"
// printed line elsewhere on the page.
//
// Real user report (shared as an actual passport photo): "Expires: not detected" and "MRZ checksum:
// 2/4 matched", even though the physical passport's expiry was perfectly legible in print. Fixed by
// extractPrintedExpiryDate() -- the same fallback pattern as extractPrintedBirthDate -- triggered
// whenever the MRZ-parsed expiry date is null OR its check digit doesn't match.
import { validateMrz, parseMrzFields } from '../mrz';

const TEXT = [
  'REPUBLIC OF NIGERIA',
  'PASSPORT',
  "Date of Expiry / Date d'Expiration 06 OCT / OCT 27",
  'P<NGAAFENI<<MARY<<<<<<<<<<<<<<<<<<<<<<<<<<<<',
  'B5033859<2NGA8803090F#710062<<<<<<<<<<<<<<04',
].join('\n');

test('validateMrz cannot parse the MRZ expiry field at all (non-digit character breaks it outright)', () => {
  const mrz = validateMrz(TEXT);
  expect(mrz).not.toBeNull();
  expect(mrz?.checks.expiryDate).toBe(false);
});

test('parseMrzFields recovers the true 2027-10-06 expiry date from the printed text fallback', () => {
  const fields = parseMrzFields(TEXT);
  expect(fields).not.toBeNull();
  expect(fields?.expiryDate).not.toBeNull();
  expect(fields?.expiryDate?.getFullYear()).toBe(2027);
  expect(fields?.expiryDate?.getMonth()).toBe(9); // October (0-indexed)
  expect(fields?.expiryDate?.getDate()).toBe(6);
  expect(fields?.expiryDateSource).toBe('printed');
});
