// Ported scenarios from index.html's crossCheckBusinessDrawings/appendCrossCheckMessage
// (~line 12398-12426) and the findRecurringPaymentToPerson-driven messaging in
// runBusinessStatementAnalysis (~12522-12552).

import {
  crossCheckBusinessDrawings,
  buildRecurringDrawingMessage,
  buildCrossCheckMessage,
  CROSSCHECK_DAY_WINDOW,
} from '../businessDrawings';
import { findRecurringPaymentToPerson } from '../names';
import { txn } from './testHelpers';

describe('crossCheckBusinessDrawings', () => {
  test('null when there are no business drawings at all', () => {
    expect(crossCheckBusinessDrawings([], [{ date: new Date('2024-01-05'), amount: 100000 }])).toBeNull();
  });

  test('null when the personal statement has not been scanned (null credits)', () => {
    expect(crossCheckBusinessDrawings([{ date: new Date('2024-01-05'), amount: 100000 }], null)).toBeNull();
  });

  test('all matched within the day window and amount tolerance', () => {
    const business = [
      { date: new Date('2024-01-05'), amount: 100000 },
      { date: new Date('2024-02-05'), amount: 100000 },
    ];
    const personal = [
      { date: new Date('2024-01-08'), amount: 98000 }, // within 10 days, within 12%
      { date: new Date('2024-02-06'), amount: 100000 },
    ];
    const result = crossCheckBusinessDrawings(business, personal);
    expect(result).toEqual({ matched: 2, total: 2 });
  });

  test('partial match when only some drawings land on the personal side', () => {
    const business = [
      { date: new Date('2024-01-05'), amount: 100000 },
      { date: new Date('2024-02-05'), amount: 100000 },
    ];
    const personal = [{ date: new Date('2024-01-08'), amount: 98000 }];
    const result = crossCheckBusinessDrawings(business, personal);
    expect(result).toEqual({ matched: 1, total: 2 });
  });

  test('no match when outside the day window', () => {
    const business = [{ date: new Date('2024-01-01'), amount: 100000 }];
    const personal = [{ date: new Date('2024-01-20'), amount: 100000 }]; // 19 days later
    expect(crossCheckBusinessDrawings(business, personal)).toEqual({ matched: 0, total: 1 });
  });

  test('no match when outside the amount tolerance', () => {
    const business = [{ date: new Date('2024-01-01'), amount: 100000 }];
    const personal = [{ date: new Date('2024-01-03'), amount: 50000 }]; // way more than 12% off
    expect(crossCheckBusinessDrawings(business, personal)).toEqual({ matched: 0, total: 1 });
  });

  test('day gap exactly at the window boundary still counts', () => {
    const business = [{ date: new Date('2024-01-01'), amount: 100000 }];
    const personal = [{ date: new Date(new Date('2024-01-01').getTime() + CROSSCHECK_DAY_WINDOW * 86400000), amount: 100000 }];
    expect(crossCheckBusinessDrawings(business, personal)).toEqual({ matched: 1, total: 1 });
  });
});

describe('buildRecurringDrawingMessage', () => {
  test('ok message when a recurring drawing is found in 2+ months', () => {
    const match = { monthsSeen: 3, avgAmount: 250000, transactions: [] };
    const result = buildRecurringDrawingMessage(match, 4);
    expect(result.status).toBe('ok');
    expect(result.message).toContain('3 of 4 month(s)');
    expect(result.message).toContain('₦250,000');
  });

  test('warn message when no recurring drawing is found', () => {
    const match = { monthsSeen: 0, avgAmount: 0, transactions: [] };
    const result = buildRecurringDrawingMessage(match, 4);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('separate legal entity');
  });

  test('warn message when a drawing is found but in fewer than 2 months', () => {
    const match = { monthsSeen: 1, avgAmount: 250000, transactions: [] };
    const result = buildRecurringDrawingMessage(match, 4);
    expect(result.status).toBe('warn');
  });
});

describe('buildCrossCheckMessage', () => {
  test('warn when none of the drawings matched', () => {
    const result = buildCrossCheckMessage({ matched: 0, total: 3 });
    expect(result.status).toBe('warn');
    expect(result.message).toContain('none of the 3');
  });

  test('warn when only some of the drawings matched', () => {
    const result = buildCrossCheckMessage({ matched: 2, total: 3 });
    expect(result.status).toBe('warn');
    expect(result.message).toContain('2 of 3');
  });

  test('ok when all drawings matched', () => {
    const result = buildCrossCheckMessage({ matched: 3, total: 3 });
    expect(result.status).toBe('ok');
    expect(result.message).toContain('all 3 of 3');
  });
});

describe('findRecurringPaymentToPerson + businessDrawings integration', () => {
  test('a real business statement with a monthly director drawing feeds a matching ok message', () => {
    const txns = [
      txn({ dateISO: '2024-01-15', debit: 300000, narration: "DIRECTOR'S DRAWING - JAN" }),
      txn({ dateISO: '2024-02-15', debit: 300000, narration: "DIRECTOR'S DRAWING - FEB" }),
      txn({ dateISO: '2024-01-10', credit: 500000, narration: 'CUSTOMER PAYMENT' }),
    ];
    const match = findRecurringPaymentToPerson(txns, { name: 'Ade Bello' });
    expect(match.monthsSeen).toBe(2);
    const msg = buildRecurringDrawingMessage(match, 2);
    expect(msg.status).toBe('ok');

    const personalCredits = [
      { date: new Date('2024-01-16'), amount: 300000 },
      { date: new Date('2024-02-16'), amount: 300000 },
    ];
    const cc = crossCheckBusinessDrawings(match.transactions, personalCredits);
    expect(cc).toEqual({ matched: 2, total: 2 });
    expect(buildCrossCheckMessage(cc!).status).toBe('ok');
  });
});
