// Shared types for the MRZ (passport machine-readable zone) parsing/correction engine, ported from
// index.html. This module is PURE LOGIC — no DOM, no camera/OCR wiring, no persistence. Those live in
// a later pass; here we only need the shapes the pure functions consume and produce.

/** Result of findMrzLinesWithIndex: the two normalized 44-char MRZ lines, plus which original
 * (newline-split) text-line indices they came from — so callers like stripMrzLines can exclude
 * exactly those lines without re-implementing the same detection logic. */
export interface MrzLinesWithIndex {
  lines: [string, string];
  indices: [number, number];
}

/** Per-field checksum results from validateMrz — null means "not checkable" (the field's own check
 * digit position wasn't a clean digit), true/false means the checksum passed/failed. */
export interface MrzChecks {
  passportNumber: boolean | null;
  birthDate: boolean | null;
  expiryDate: boolean | null;
  composite: boolean | null;
}

/** Which fields validateMrz applied a checksum-verified digit-swap (or letter->digit) correction to. */
export interface MrzCorrections {
  birthDate: boolean;
  expiryDate: boolean;
}

/** Result of validateMrz(text) — a FORMAT/CHECKSUM check only. A pass means the two-line MRZ strip is
 * internally consistent; it does NOT confirm the document is genuine, unaltered, or unrevoked. */
export interface MrzValidationResult {
  checks: MrzChecks;
  passedCount: number;
  totalCount: number;
  /** The (possibly digit/letter-corrected) 6-digit YYMMDD birth date field. */
  birth: string;
  /** The (possibly digit/letter-corrected) 6-digit YYMMDD expiry date field. */
  expiry: string;
  corrections: MrzCorrections;
}

/** Where a parsed date ultimately came from: read straight off the MRZ, or recovered from the
 * plain printed text elsewhere on the page when the MRZ read was unusable/failed its checksum. */
export type MrzDateSource = 'mrz' | 'printed';

/** Full structured read of a TD3 (passport) MRZ, as produced by parseMrzFields. Still a best-effort
 * text/format read, not a genuineness check — no public API exists to verify passport authenticity. */
export interface ParsedPassportFields {
  docType: string;
  issuingCountry: string;
  surname: string;
  given: string;
  fullName: string;
  passportNumber: string;
  nationality: string;
  birthDate: Date | null;
  birthDateSource: MrzDateSource;
  sex: string;
  expiryDate: Date | null;
  expiryDateSource: MrzDateSource;
  mrz: MrzValidationResult | null;
}

/** Options accepted by extractDates — bounds the plausible year range for a match. */
export interface ExtractDatesOptions {
  minYear?: number;
  maxYear?: number;
}
