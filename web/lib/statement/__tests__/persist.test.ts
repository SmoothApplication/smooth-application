// Phase 4 of the bank-statement port: covers the round-trip serialize/deserialize helpers used by
// sa_uk_statement persistence (web/app/checklist/uk/statement/page.tsx).
import { serializeTxns, deserializeTxns } from '../persist';
import { txn } from './testHelpers';

test('serializeTxns produces plain-data rows with ISO dates and no Date objects', () => {
  const txns = [
    txn({ narration: 'NIP TRF FROM JANE DOE', credit: 100000, dateISO: '2026-03-10' }),
    txn({ narration: 'POS PURCHASE', debit: 5000, dateISO: '2026-03-11', balance: 95000 }),
  ];

  const persisted = serializeTxns(txns);

  expect(persisted).toEqual([
    { dateISO: '2026-03-10T00:00:00.000Z', narration: 'NIP TRF FROM JANE DOE', credit: 100000, debit: 0, balance: 0 },
    { dateISO: '2026-03-11T00:00:00.000Z', narration: 'POS PURCHASE', credit: 0, debit: 5000, balance: 95000 },
  ]);
  // Nothing but plain JSON-safe values - no Date instances anywhere in the output.
  expect(JSON.parse(JSON.stringify(persisted))).toEqual(persisted);
});

test('serializeTxns carries the amountMatchedReversal flag across using its public field name', () => {
  const t = txn({ narration: 'ONB TRF TO POS Transf **7126', credit: 8400, dateISO: '2026-03-03' });
  t.__amountMatchedReversal = true;

  const [persisted] = serializeTxns([t]);

  expect(persisted.amountMatchedReversal).toBe(true);
});

test('deserializeTxns reverses serializeTxns exactly (round trip)', () => {
  const original = [
    txn({ narration: 'NIP TRF FROM JANE DOE', credit: 100000, dateISO: '2026-03-10', balance: 500000 }),
  ];
  original[0].__amountMatchedReversal = true;

  const roundTripped = deserializeTxns(serializeTxns(original));

  expect(roundTripped).toHaveLength(1);
  expect(roundTripped[0].date.toISOString()).toBe(original[0].date.toISOString());
  expect(roundTripped[0].narration).toBe(original[0].narration);
  expect(roundTripped[0].credit).toBe(original[0].credit);
  expect(roundTripped[0].debit).toBe(original[0].debit);
  expect(roundTripped[0].balance).toBe(original[0].balance);
  expect(roundTripped[0].__amountMatchedReversal).toBe(true);
});

test('deserializeTxns tolerates a missing/empty txns array', () => {
  expect(deserializeTxns(undefined as unknown as [])).toEqual([]);
  expect(deserializeTxns([])).toEqual([]);
});
