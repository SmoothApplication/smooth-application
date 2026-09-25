// Ported from tests/sender-duplicate-prompt.test.js — PURE matching logic only (senderPairKey,
// sharedSignificantWords, applySenderDuplicateDecisions). The original test also exercised a rendered
// UI prompt banner and click-driven merge/separate decisions — out of scope here, since this app has
// no interactive duplicate-sender-prompt UI wired to persistence yet; only the underlying matching
// functions exist.
//
// User report, off their own live bank-statement testing of the "Top 10 most consistent senders"
// table: two rows were actually the SAME real person, just extracted with different word sets from
// different narration rows. Their explicit ask: "If you see a name with 2 or more similar names ask
// the user if it is the same person" — NOT auto-merge, since two different family members can
// legitimately share a surname. Reproduces the same fixture shape as the original PDF fixture
// (fictional names): "Tunde Bassey Ekpo" (2 months) and "Bassey Ekpo Adisa" (3 months) share 2
// significant words ("Bassey", "Ekpo") and should be flagged as a pending duplicate pair; "Chidi
// Ogbonna Traders" shares no words with either and must never be pulled into a duplicate prompt.
import { applySenderDuplicateDecisions, senderPairKey, sharedSignificantWords } from '../classify';
import { txn } from './testHelpers';
import type { ParsedTxn } from '../types';

function buildNamedGroups(): Record<string, ParsedTxn[]> {
  return {
    'Tunde Bassey Ekpo': [
      txn({ narration: 'NIP/TUNDE BASSEY EKPO/TRF', credit: 20000, dateISO: '2026-01-10' }),
      txn({ narration: 'NIP/TUNDE BASSEY EKPO/TRF', credit: 20000, dateISO: '2026-02-10' }),
    ],
    'Bassey Ekpo Adisa': [
      txn({ narration: 'NIP/BASSEY EKPO ADISA/TRF', credit: 15000, dateISO: '2026-01-20' }),
      txn({ narration: 'NIP/BASSEY EKPO ADISA/TRF', credit: 15000, dateISO: '2026-02-20' }),
      txn({ narration: 'NIP/BASSEY EKPO ADISA/TRF', credit: 15000, dateISO: '2026-03-20' }),
    ],
    'Chidi Ogbonna Traders': [
      txn({ narration: 'NIP/CHIDI OGBONNA TRADERS/TRF', credit: 30000, dateISO: '2026-01-15' }),
    ],
  };
}

test('sharedSignificantWords finds the 2+ shared words that make a pair look like the same person', () => {
  const shared = sharedSignificantWords('Tunde Bassey Ekpo', 'Bassey Ekpo Adisa');
  expect(shared.sort()).toEqual(['bassey', 'ekpo']);
  expect(sharedSignificantWords('Tunde Bassey Ekpo', 'Chidi Ogbonna Traders')).toEqual([]);
});

test('senderPairKey is order-independent (same key regardless of argument order)', () => {
  expect(senderPairKey('Tunde Bassey Ekpo', 'Bassey Ekpo Adisa')).toBe(
    senderPairKey('Bassey Ekpo Adisa', 'Tunde Bassey Ekpo')
  );
});

test('flags exactly the one genuine look-alike pair as pending, leaving the unrelated sender alone', () => {
  const namedGroups = buildNamedGroups();
  const { pending } = applySenderDuplicateDecisions(namedGroups);

  expect(pending.length).toBe(1);
  const pair = pending[0];
  const namesInPair = [pair.nameA, pair.nameB];
  expect(namesInPair).toContain('Tunde Bassey Ekpo');
  expect(namesInPair).toContain('Bassey Ekpo Adisa');
  const pendingJson = JSON.stringify(pending);
  expect(/Chidi Ogbonna Traders/.test(pendingJson)).toBe(false);
});

test('"merge" decision combines the two look-alike senders into one group with combined months/count', () => {
  const namedGroups = buildNamedGroups();
  const key = senderPairKey('Tunde Bassey Ekpo', 'Bassey Ekpo Adisa');
  const { merged, pending } = applySenderDuplicateDecisions(namedGroups, { [key]: 'merge' });

  expect(pending.length).toBe(0);
  // Both names are the same length (17 chars) - merges into whichever comes first ("Tunde Bassey
  // Ekpo", the canonical name a.length >= b.length picks when lengths tie).
  const mergedNames = Object.keys(merged);
  expect(mergedNames).toContain('Tunde Bassey Ekpo');
  expect(mergedNames).not.toContain('Bassey Ekpo Adisa');
  expect(merged['Tunde Bassey Ekpo'].length).toBe(5); // 2 + 3 combined payments
  expect(mergedNames).toContain('Chidi Ogbonna Traders');
});

test('"separate" decision keeps both rows apart and never re-flags that pair', () => {
  const namedGroups = buildNamedGroups();
  const key = senderPairKey('Tunde Bassey Ekpo', 'Bassey Ekpo Adisa');
  const { merged, pending } = applySenderDuplicateDecisions(namedGroups, { [key]: 'separate' });

  expect(pending.length).toBe(0);
  expect(Object.keys(merged)).toContain('Tunde Bassey Ekpo');
  expect(Object.keys(merged)).toContain('Bassey Ekpo Adisa');
  expect(merged['Tunde Bassey Ekpo'].length).toBe(2);
  expect(merged['Bassey Ekpo Adisa'].length).toBe(3);
});

test('a singleton sharing just ONE significant word with another sender is still flagged (relaxed threshold)', () => {
  const namedGroups: Record<string, ParsedTxn[]> = {
    'Funmi Afeni': [txn({ narration: 'NIP/FUNMI AFENI/TRF', credit: 10000, dateISO: '2026-01-01' })],
    'Funmi Agboola': [
      txn({ narration: 'NIP/FUNMI AGBOOLA/TRF', credit: 12000, dateISO: '2026-01-05' }),
      txn({ narration: 'NIP/FUNMI AGBOOLA/TRF', credit: 12000, dateISO: '2026-02-05' }),
    ],
  };
  const { pending } = applySenderDuplicateDecisions(namedGroups);
  expect(pending.length).toBe(1);
});
