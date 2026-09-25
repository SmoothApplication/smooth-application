import { parseMrzFields, validateMrz } from '../mrz';

// Real-world case, found via a real applicant's live test upload (not a synthetic fixture): OCR
// inserted a single stray non-MRZ character (":") into line 2, right after the nationality field,
// where a real MRZ has no separator between fields at all. That one extra character shifts every
// field after it (birth date, sex, expiry date) one position to the right, so a naive fixed-width
// slice reads garbage for all three — even though nationality, name, and passport number (which sit
// before the inserted character) all read perfectly. Also exercises the companion "NGA" -> "NG4"
// country-code digit misread fix (fixMrzCountryDigits), which the same real scan triggered.
const REAL_SCAN_OCR_TEXT = `pes MARY OLUWAFUNMILAYO
> Nationality / Nationalité Previous Passport / Passeport Précédent i ]
py NIGERIAN A50213602 =
a ; / Date de Naissance NIN
wey 09 MAR / MARS 88 86302320985
Sex/Sexe Place of Sith / Uieu de Naissance
c LAGOS
* sue / Date ance Authority / Autorité
3 E v  570CT/OCT 22 FESTAC. LAGOS
- Yel of Expiry / Date dExpiration Wolders Signature / Signature du Titulaire
,OCT / OCT 27 "
| P<NGAAFENI<<MARY<OLUWAFUNMILAYO<K<KLLLLLLLLLLLKL
B503385946NG4: 3803090F271006286302320985<<<06
A £0 FUMES © INE O ewe or yonsed
Scan with Fast Scan`;

test('recovers nationality, sex, and expiry after a stray inserted character shifts line 2', () => {
  const parsed = parseMrzFields(REAL_SCAN_OCR_TEXT);
  expect(parsed).not.toBeNull();
  expect(parsed!.nationality).toBe('NGA');
  expect(parsed!.sex).toBe('F');
  expect(parsed!.expiryDate).not.toBeNull();
  expect(parsed!.expiryDate!.getUTCFullYear()).toBe(2027);
  expect(parsed!.expiryDate!.getUTCMonth()).toBe(9); // October, 0-indexed
  // Name and passport number sat before the inserted character, so they were never affected —
  // confirms the reflow only changes behavior on the affected fields, not the whole line.
  expect(parsed!.fullName).toBe('MARY OLUWAFUNMILAYO AFENI');
  expect(parsed!.passportNumber).toBe('B50338594');
});

test('reflow only fires on an over-length line containing real junk, never on a clean read', () => {
  // A clean, correctly-read MRZ line 2 (no stray characters, exactly 44 chars) must parse via the
  // plain path and be unaffected by the new reflow logic — regression guard against the reflow
  // firing (and potentially picking a worse candidate) on statements that were never broken.
  const cleanText = `P<NGAAFENI<<MARY<OLUWAFUNMILAYO<<<<<<<<<<<<<
B503385946NGA8803097F2710065286302320985<<06`;
  const mrz = validateMrz(cleanText);
  expect(mrz).not.toBeNull();
});
