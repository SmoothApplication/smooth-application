// Phase 3 of the passport-MRZ port: covers the round-trip serialize/deserialize helpers used by
// sa_uk_passport persistence (web/app/checklist/uk/passport/page.tsx).
import {
  serializePassportFields,
  deserializePassportFields,
  hasPassportFields,
  EMPTY_PASSPORT_FIELDS,
  FieldState,
} from '../persist';

const FULL: FieldState = {
  fullName: 'JANE ANN DOE',
  birthDate: '1990-05-17',
  passportNumber: 'A1234567',
  nationality: 'NIGERIAN',
  sex: 'F',
  expiryDate: '2030-01-01',
};

test('serializePassportFields produces a plain-data object with the same six string fields', () => {
  const persisted = serializePassportFields(FULL);

  expect(persisted).toEqual(FULL);
  // Nothing but plain JSON-safe values.
  expect(JSON.parse(JSON.stringify(persisted))).toEqual(persisted);
});

test('serializePassportFields fills in missing/undefined fields as empty strings', () => {
  const partial = { fullName: 'JANE DOE' } as unknown as FieldState;

  const persisted = serializePassportFields(partial);

  expect(persisted).toEqual({ ...EMPTY_PASSPORT_FIELDS, fullName: 'JANE DOE' });
});

test('deserializePassportFields reverses serializePassportFields exactly (round trip)', () => {
  const roundTripped = deserializePassportFields(serializePassportFields(FULL));

  expect(roundTripped).toEqual(FULL);
});

test('deserializePassportFields tolerates a missing/null payload by returning empty fields', () => {
  expect(deserializePassportFields(null)).toEqual(EMPTY_PASSPORT_FIELDS);
  expect(deserializePassportFields(undefined)).toEqual(EMPTY_PASSPORT_FIELDS);
});

test('hasPassportFields is true when any field is non-empty, false when all are empty', () => {
  expect(hasPassportFields(EMPTY_PASSPORT_FIELDS)).toBe(false);
  expect(hasPassportFields(null)).toBe(false);
  expect(hasPassportFields({ ...EMPTY_PASSPORT_FIELDS, passportNumber: 'A1234567' })).toBe(true);
  expect(hasPassportFields(FULL)).toBe(true);
});
