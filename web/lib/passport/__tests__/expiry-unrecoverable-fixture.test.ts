// Ported from tests/expiry-not-detected-jump-link.test.js. The original test drove this through a
// real PDF (expiry-unrecoverable-fixture.pdf) via the full upload -> OCR -> render pipeline, then
// asserted the UI showed a "not detected" expiry with a "type it in below" jump link to the manual
// field. Text extracted here directly from that same PDF with `pdftotext` (it's a text-layer PDF,
// not a scanned image, so this is the exact text the app's own PDF-text-extraction path would read —
// no OCR guessing involved).
//
// Real case this exercises: the MRZ's expiry field came back as "XXXXXX" — not a simple OCR-confusable
// digit swap (which findMrzFieldCorrectionCandidates could fix) but non-digit noise that can't be
// checksum-corrected at all, AND this particular bio page has no printed "Date of Expiry" line either
// (only "Date of Issue"), so extractPrintedExpiryDate's label-based fallback has nothing to find. This
// is the genuine dead end the "type it in below" UI affordance exists for: parseMrzFields should return
// a null expiryDate here rather than silently guessing, while every other field on the same page
// (name, passport number, nationality, sex, birth date) still reads correctly — proving the failure is
// isolated to the one field that's actually unrecoverable, not a broader parse failure.
import { parseMrzFields } from '../mrz';

const TEXT = [
  'FEDERAL REPUBLIC OF NIGERIA',
  'Passport / Passeport',
  'Country Code/Code du pays',
  'Passport No./No du passeport',
  'P',
  'NGA',
  'B12345678',
  'Surname/Nom',
  'IBRAHIM',
  'Given Names/Prenoms',
  'FATIMA ADAEZE',
  'Nationality/Nationalite',
  'NIGERIAN',
  'Date of Birth / Date de Naissance',
  '15 MAY / MAI 95',
  'Sex/Sexe',
  'Place of Birth / Lieu de Naissance',
  'F',
  'ABUJA',
  'Date of Issue / Date de Delivrance',
  'Authority/Autorite',
  '10 JUN / JUIN 22',
  'ABUJA',
  'P<NGAIBRAHIM<<FATIMA<ADAEZE<<<<<<<<<<<<<<<<<',
  'B123456781NGA9505151FXXXXXX0<<<<<<<<<<<<<<<0',
].join('\n');

test('parseMrzFields leaves expiryDate null when the MRZ field is unrecoverable and no printed expiry line exists', () => {
  const fields = parseMrzFields(TEXT);
  expect(fields).not.toBeNull();
  expect(fields?.expiryDate).toBeNull();
});

test('parseMrzFields still reads every other field correctly on the same page', () => {
  const fields = parseMrzFields(TEXT);
  expect(fields).not.toBeNull();
  expect(fields?.fullName).toBe('FATIMA ADAEZE IBRAHIM');
  expect(fields?.passportNumber).toBe('B12345678');
  expect(fields?.nationality).toBe('NGA');
  expect(fields?.sex).toBe('F');
  expect(fields?.birthDate).not.toBeNull();
  expect(fields?.birthDate?.getFullYear()).toBe(1995);
  expect(fields?.birthDate?.getMonth()).toBe(4); // May (0-indexed)
  expect(fields?.birthDate?.getDate()).toBe(15);
  expect(fields?.birthDateSource).toBe('mrz');
});

test('extractPrintedExpiryDate finds nothing to fall back to — this page genuinely has no printed expiry line, only a Date of Issue', () => {
  // Guards the test fixture itself: if this ever started matching (e.g. a future label-regex change
  // widened enough to catch "Date of Issue"), it would silently defeat the point of this fixture.
  const fields = parseMrzFields(TEXT);
  expect(fields?.expiryDateSource).toBe('mrz'); // never flipped to 'printed', because nothing was found
});
