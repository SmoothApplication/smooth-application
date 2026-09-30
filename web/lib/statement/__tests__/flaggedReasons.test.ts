// Direct instruction, verbatim, off a live screenshot showing 4 separate cards all headed "MARY
// OLUWAFUNMILAYO AFENI": "to group all inflows from similar names together then you create a
// button that says is it for the same purpose then the purpose has a drop down or for different
// purposes if you click for the same purposes it fills it straight into the excel file that is
// created that they are all for the same purposes if it fills for different purposes it will take
// the input for each purpose that was filled from the drop down menu."
import { findUnexplainedLargeInflows, groupFlaggedInflows } from '../classify';
import {
  nestFlaggedGroupsBySender,
  txnSignature,
  resolveFlaggedReasonLabel,
  effectiveReasonMode,
  buildFlaggedTxnReasons,
  UNEXPLAINED_REASON_OPTIONS,
  SenderInflowGroup,
} from '../flaggedReasons';
import type { ParsedTxn } from '../types';

function txn(dateISO: string, credit: number, narration: string): ParsedTxn {
  return { date: new Date(dateISO), credit, debit: 0, balance: 0, narration };
}

describe('nestFlaggedGroupsBySender', () => {
  test('collapses a sender\'s several (month, amount) sub-groups into one sender card', () => {
    const txns = [
      txn('2026-08-05', 100000, 'MARY OLUWAFUNMILAYO AFENI TRF'),
      txn('2026-04-05', 80000, 'MARY OLUWAFUNMILAYO AFENI TRF'),
      txn('2026-08-06', 60000, 'MARY OLUWAFUNMILAYO AFENI TRF'),
    ];
    const flat = groupFlaggedInflows(findUnexplainedLargeInflows(txns));
    expect(flat.length).toBe(3); // still 3 distinct (sender, month, amount) groups
    const nested = nestFlaggedGroupsBySender(flat);
    expect(nested.length).toBe(1); // one card for the sender
    expect(nested[0].subGroups.length).toBe(3);
    expect(nested[0].count).toBe(3);
    expect(nested[0].total).toBe(240000);
  });

  test('keeps different senders as separate cards', () => {
    const txns = [
      txn('2026-08-05', 100000, 'MARY OLUWAFUNMILAYO AFENI TRF'),
      txn('2026-07-05', 64500, 'YARO HADIZA TRF'),
    ];
    const nested = nestFlaggedGroupsBySender(groupFlaggedInflows(findUnexplainedLargeInflows(txns)));
    expect(nested.length).toBe(2);
  });

  test('sorts sender cards by total descending', () => {
    const txns = [
      txn('2026-03-01', 50000, 'AMAKA OKORO TRF'),
      txn('2026-03-02', 200000, 'CHINEDU EZE TRF'),
    ];
    const nested = nestFlaggedGroupsBySender(groupFlaggedInflows(findUnexplainedLargeInflows(txns)));
    expect(nested[0].total).toBeGreaterThanOrEqual(nested[1].total);
  });

  test('empty input returns no sender groups', () => {
    expect(nestFlaggedGroupsBySender([])).toEqual([]);
  });
});

describe('txnSignature', () => {
  test('is stable for the same date/amount/narration and differs when any one changes', () => {
    const t1 = txn('2026-08-05', 100000, 'MARY TRF');
    const t2 = txn('2026-08-05', 100000, 'MARY TRF');
    const t3 = txn('2026-08-05', 100000, 'DIFFERENT NARRATION');
    expect(txnSignature(t1)).toBe(txnSignature(t2));
    expect(txnSignature(t1)).not.toBe(txnSignature(t3));
  });
});

describe('resolveFlaggedReasonLabel', () => {
  test('returns the canonical label for a real option', () => {
    expect(resolveFlaggedReasonLabel('gift', undefined)).toBe('Gift');
  });
  test('returns the typed-in text for "other"', () => {
    expect(resolveFlaggedReasonLabel('other', 'Proceeds from selling my car')).toBe(
      'Proceeds from selling my car'
    );
  });
  test('returns empty string when nothing has been chosen', () => {
    expect(resolveFlaggedReasonLabel(undefined, undefined)).toBe('');
  });
  test('unknown choice value resolves to empty string', () => {
    expect(resolveFlaggedReasonLabel('not-a-real-option', undefined)).toBe('');
  });
});

describe('effectiveReasonMode', () => {
  test('a sender with only one sub-group is always "same", regardless of stored mode', () => {
    const sg: Pick<SenderInflowGroup, 'senderKey' | 'subGroups'> = {
      senderKey: 'Yaro Hadiza',
      subGroups: [{} as any],
    };
    expect(effectiveReasonMode(sg, { 'Yaro Hadiza': 'different' })).toBe('same');
  });
  test('a sender with multiple sub-groups defaults to "same" until explicitly set', () => {
    const sg: Pick<SenderInflowGroup, 'senderKey' | 'subGroups'> = {
      senderKey: 'Mary Oluwafunmilayo Afeni',
      subGroups: [{} as any, {} as any],
    };
    expect(effectiveReasonMode(sg, {})).toBe('same');
    expect(effectiveReasonMode(sg, { 'Mary Oluwafunmilayo Afeni': 'different' })).toBe('different');
  });
});

describe('buildFlaggedTxnReasons', () => {
  test('"same purpose" applies one resolved reason to every transaction across all sub-groups', () => {
    const txns = [
      txn('2026-08-05', 100000, 'MARY OLUWAFUNMILAYO AFENI TRF'),
      txn('2026-04-05', 80000, 'MARY OLUWAFUNMILAYO AFENI TRF'),
    ];
    const nested = nestFlaggedGroupsBySender(groupFlaggedInflows(findUnexplainedLargeInflows(txns)));
    const senderKey = nested[0].senderKey;
    const out = buildFlaggedTxnReasons(nested, {}, { [senderKey]: 'family' }, {});
    expect(Object.keys(out).length).toBe(2);
    expect(Object.values(out)).toEqual(['Family support', 'Family support']);
  });

  test('"different purposes" gives each sub-group its own resolved reason', () => {
    const txns = [
      txn('2026-08-05', 100000, 'MARY OLUWAFUNMILAYO AFENI TRF'),
      txn('2026-04-05', 80000, 'MARY OLUWAFUNMILAYO AFENI TRF'),
    ];
    const nested = nestFlaggedGroupsBySender(groupFlaggedInflows(findUnexplainedLargeInflows(txns)));
    const senderKey = nested[0].senderKey;
    const [g1, g2] = nested[0].subGroups;
    const out = buildFlaggedTxnReasons(
      nested,
      { [senderKey]: 'different' },
      { [g1.key]: 'gift', [g2.key]: 'loan' },
      {}
    );
    const label1 = out[txnSignature(g1.txns[0])];
    const label2 = out[txnSignature(g2.txns[0])];
    expect([label1, label2].sort()).toEqual(['Gift', 'Loan or loan repayment'].sort());
  });

  test('an unanswered sender contributes nothing to the map', () => {
    const txns = [txn('2026-08-05', 100000, 'MARY OLUWAFUNMILAYO AFENI TRF')];
    const nested = nestFlaggedGroupsBySender(groupFlaggedInflows(findUnexplainedLargeInflows(txns)));
    expect(buildFlaggedTxnReasons(nested, {}, {}, {})).toEqual({});
  });

  test('"other" with typed text resolves to that text in the export map', () => {
    const txns = [txn('2026-08-05', 100000, 'MARY OLUWAFUNMILAYO AFENI TRF')];
    const nested = nestFlaggedGroupsBySender(groupFlaggedInflows(findUnexplainedLargeInflows(txns)));
    const senderKey = nested[0].senderKey;
    const out = buildFlaggedTxnReasons(
      nested,
      {},
      { [senderKey]: 'other' },
      { [senderKey]: 'Refund from a cancelled land deal' }
    );
    expect(Object.values(out)[0]).toBe('Refund from a cancelled land deal');
  });
});

describe('UNEXPLAINED_REASON_OPTIONS', () => {
  test('includes an "other" option with free text, and every other option has a plain-language label', () => {
    expect(UNEXPLAINED_REASON_OPTIONS.some((o) => o.value === 'other')).toBe(true);
    UNEXPLAINED_REASON_OPTIONS.forEach((o) => expect(o.label.length).toBeGreaterThan(0));
  });
});
