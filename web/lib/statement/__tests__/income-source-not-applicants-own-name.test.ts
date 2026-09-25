// Ported from tests/income-source-not-applicants-own-name.test.js.
// User feedback (with screenshots + their own manually-reconciled spreadsheet cross-check): a
// recurring inflow was misattributed to "SALARY" from the APPLICANT'S OWN NAME rather than the real,
// distinct person who actually sent the money. Root cause: bank narrations typically name BOTH sides
// of a transfer ("...TRF TO <applicant> FROM <sender>..."), and extractNameCandidates() returned every
// name-shaped word run with no notion of which side is which — the applicant's own typed name recurred
// across nearly every narration and kept winning the "most recurring sender" vote in
// identifyIncomeSourceName(), getTopConsistentSenders(), and identifyTopIncomeSource(). This models the
// same fixture shape as the original: 4 identical-amount inflows narrated "TRF TO TEST APPLICANT FROM
// BLESSING NWOSU", asserting the real sender — not the applicant — wins everywhere that check runs.
import { identifyIncomeSourceName, identifyTopIncomeSource } from '../names';
import { getTopConsistentSenders } from '../classify';
import { identifyStableIncome } from '../parse';
import { txn } from './testHelpers';

function buildTxns() {
  return [
    txn({ narration: 'NIP TRF TO TEST APPLICANT FROM BLESSING NWOSU', credit: 150000, dateISO: '2026-01-05' }),
    txn({ narration: 'NIP TRF TO TEST APPLICANT FROM BLESSING NWOSU', credit: 150000, dateISO: '2026-02-05' }),
    txn({ narration: 'NIP TRF TO TEST APPLICANT FROM BLESSING NWOSU', credit: 150000, dateISO: '2026-03-05' }),
    txn({ narration: 'NIP TRF TO TEST APPLICANT FROM BLESSING NWOSU', credit: 150000, dateISO: '2026-04-05' }),
    // One unrelated debit so the statement isn't suspiciously all-credits.
    txn({ narration: 'POS PURCHASE SUPERMARKET', debit: 5000, dateISO: '2026-01-10' }),
  ];
}

test('identifyIncomeSourceName never identifies the applicant as their own recurring income source', () => {
  const txns = buildTxns();
  const stable = identifyStableIncome(txns);
  expect(stable).not.toBeNull();
  const result = identifyIncomeSourceName(txns, stable!.amount, 'Test Applicant');
  expect(result).not.toBeNull();
  expect(result!.name).toBe('Blessing Nwosu');
});

test('identifyTopIncomeSource never identifies the applicant as the most frequent inflow source', () => {
  const result = identifyTopIncomeSource(buildTxns(), 'Test Applicant');
  expect(result).not.toBeNull();
  expect(result!.name).toBe('Blessing Nwosu');
});

test('getTopConsistentSenders lists the real sender and never the applicant\'s own name', () => {
  const result = getTopConsistentSenders(buildTxns(), 10, 'Test Applicant');
  const names = result.list.map((r) => r.name);
  expect(names).toContain('Blessing Nwosu');
  expect(names).not.toContain('Test Applicant');
});
