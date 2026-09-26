// Ported scenarios from index.html's Business Income Record ledger (~line 12387-12631, 15170-15214).

import { txn } from './testHelpers';
import {
  filterBusinessCredits,
  bizLedgerEntryIsFilled,
  countFilledEntries,
  buildBizLedgerRows,
  countUnspecifiedRows,
  BizLedgerMap,
} from '../business';
import { inflowKey } from '../classify';

describe('filterBusinessCredits', () => {
  test('keeps a genuine incoming payment', () => {
    const t = txn({ narration: 'Chidinma Okeke payment for goods', credit: 15000, dateISO: '2026-01-05' });
    expect(filterBusinessCredits([t])).toEqual([t]);
  });

  test('drops debits (credit = 0)', () => {
    const t = txn({ narration: 'POS withdrawal', debit: 5000, dateISO: '2026-01-05' });
    expect(filterBusinessCredits([t])).toEqual([]);
  });

  test('drops a reversal', () => {
    const t = txn({ narration: 'RVSL failed transfer', credit: 20000, dateISO: '2026-01-05' });
    expect(filterBusinessCredits([t])).toEqual([]);
  });

  test('drops a non-income charge credit (e.g. a fee refund)', () => {
    const t = txn({ narration: 'CARD MAINTENANCE FEE reversal credit', credit: 50, dateISO: '2026-01-05' });
    expect(filterBusinessCredits([t])).toEqual([]);
  });

  test('mixed statement keeps only the genuine credits', () => {
    const good1 = txn({ narration: 'Payment from Uche Eze', credit: 30000, dateISO: '2026-01-02' });
    const debit = txn({ narration: 'Supplier payment', debit: 10000, dateISO: '2026-01-03' });
    const reversal = txn({ narration: 'reversal of failed payment', credit: 10000, dateISO: '2026-01-04' });
    const good2 = txn({ narration: 'Market sale', credit: 8000, dateISO: '2026-01-06' });
    expect(filterBusinessCredits([good1, debit, reversal, good2])).toEqual([good1, good2]);
  });
});

describe('bizLedgerEntryIsFilled', () => {
  test('needs both payer and purpose', () => {
    expect(bizLedgerEntryIsFilled({ payer: 'Uche', purpose: 'Rice' })).toBe(true);
    expect(bizLedgerEntryIsFilled({ payer: 'Uche', purpose: '' })).toBe(false);
    expect(bizLedgerEntryIsFilled({ payer: '', purpose: 'Rice' })).toBe(false);
    expect(bizLedgerEntryIsFilled({ payer: '  ', purpose: '  ' })).toBe(false);
  });

  test('handles missing/undefined entries', () => {
    expect(bizLedgerEntryIsFilled(undefined)).toBe(false);
    expect(bizLedgerEntryIsFilled(null)).toBe(false);
  });
});

describe('countFilledEntries', () => {
  test('counts only the fully-noted credits', () => {
    const t1 = txn({ narration: 'Payment 1', credit: 10000, dateISO: '2026-01-01' });
    const t2 = txn({ narration: 'Payment 2', credit: 20000, dateISO: '2026-01-02' });
    const t3 = txn({ narration: 'Payment 3', credit: 30000, dateISO: '2026-01-03' });
    const ledger: BizLedgerMap = {
      [inflowKey(t1)]: { payer: 'Uche', purpose: 'Rice' },
      [inflowKey(t2)]: { payer: 'Chika', purpose: '' },
    };
    expect(countFilledEntries([t1, t2, t3], ledger)).toBe(1);
  });
});

describe('buildBizLedgerRows / countUnspecifiedRows', () => {
  test('fills in "(not specified)" for anything the applicant has not noted', () => {
    const t1 = txn({ narration: 'Payment 1', credit: 10000, dateISO: '2026-01-01' });
    const t2 = txn({ narration: 'Payment 2', credit: 20000, dateISO: '2026-01-02' });
    const ledger: BizLedgerMap = { [inflowKey(t1)]: { payer: 'Uche Eze', purpose: 'Payment for 2 bags of rice' } };
    const rows = buildBizLedgerRows([t1, t2], ledger);
    expect(rows).toEqual([
      { date: t1.date, amount: 10000, payer: 'Uche Eze', purpose: 'Payment for 2 bags of rice' },
      { date: t2.date, amount: 20000, payer: '(not specified)', purpose: '(not specified)' },
    ]);
    expect(countUnspecifiedRows(rows)).toBe(1);
  });

  test('all noted means zero unspecified rows', () => {
    const t1 = txn({ narration: 'Payment 1', credit: 10000, dateISO: '2026-01-01' });
    const ledger: BizLedgerMap = { [inflowKey(t1)]: { payer: 'Uche', purpose: 'Rice' } };
    const rows = buildBizLedgerRows([t1], ledger);
    expect(countUnspecifiedRows(rows)).toBe(0);
  });

  test('whitespace-only payer/purpose still counts as not specified', () => {
    const t1 = txn({ narration: 'Payment 1', credit: 10000, dateISO: '2026-01-01' });
    const ledger: BizLedgerMap = { [inflowKey(t1)]: { payer: '   ', purpose: '   ' } };
    const rows = buildBizLedgerRows([t1], ledger);
    expect(rows[0].payer).toBe('(not specified)');
    expect(rows[0].purpose).toBe('(not specified)');
  });
});
