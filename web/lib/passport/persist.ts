// Phase 3 of the passport-MRZ port: pure serialize/deserialize helpers for the localStorage
// persistence wired up in web/app/checklist/uk/passport/page.tsx. Mirrors lib/statement/persist.ts's
// approach: only a small plain-data reduction is persisted — never the captured photo, never the
// raw OCR text, matching the privacy promise this app makes everywhere else. Dates are kept as
// plain YYYY-MM-DD strings (already exactly what components/checklist/PassportScan.tsx's
// formatDateForInput()/<input type="date"> fields produce), so no Date<->string conversion is
// needed anywhere in this round-trip.

/** The six editable fields PassportScan exposes for correction/confirmation after a scan, as plain
 * strings. Defined here (the pure/persistence layer) rather than in the component so there's one
 * definition of "what a passport field-set looks like", the same relationship lib/statement/types.ts
 * (ParsedTxn) has to lib/statement/persist.ts. */
export interface FieldState {
  fullName: string;
  birthDate: string;
  passportNumber: string;
  nationality: string;
  sex: string;
  expiryDate: string;
}

export const EMPTY_PASSPORT_FIELDS: FieldState = {
  fullName: '',
  birthDate: '',
  passportNumber: '',
  nationality: '',
  sex: '',
  expiryDate: '',
};

/** Everything sa_uk_passport stores. Currently identical in shape to FieldState (both are already
 * plain strings) but kept as its own named type — same reasoning as lib/statement/persist.ts's
 * PersistedStatement — so the persisted-JSON shape can evolve independently of the live editing
 * state later without a silent coupling. */
export type PersistedPassportFields = FieldState;

/** True if any field has a non-empty value — used to decide whether a stored payload counts as
 * "something to recall" (an all-empty/cleared record shouldn't trigger the recalled-view). */
export function hasPassportFields(fields: FieldState | null | undefined): boolean {
  if (!fields) return false;
  return Boolean(
    fields.fullName ||
      fields.birthDate ||
      fields.passportNumber ||
      fields.nationality ||
      fields.sex ||
      fields.expiryDate
  );
}

export function serializePassportFields(fields: FieldState): PersistedPassportFields {
  return {
    fullName: fields.fullName || '',
    birthDate: fields.birthDate || '',
    passportNumber: fields.passportNumber || '',
    nationality: fields.nationality || '',
    sex: fields.sex || '',
    expiryDate: fields.expiryDate || '',
  };
}

export function deserializePassportFields(
  persisted: PersistedPassportFields | null | undefined
): FieldState {
  if (!persisted) return { ...EMPTY_PASSPORT_FIELDS };
  return {
    fullName: persisted.fullName || '',
    birthDate: persisted.birthDate || '',
    passportNumber: persisted.passportNumber || '',
    nationality: persisted.nationality || '',
    sex: persisted.sex || '',
    expiryDate: persisted.expiryDate || '',
  };
}
