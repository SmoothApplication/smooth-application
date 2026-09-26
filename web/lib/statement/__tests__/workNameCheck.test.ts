// Ported scenarios from index.html's namesToCheck mechanism (~line 14844-14953).
import { computeWorkNameCheck, buildWorkNameCheckMessages } from '../workNameCheck';
import { txn } from './testHelpers';

describe('computeWorkNameCheck + buildWorkNameCheckMessages', () => {
  test('not found anywhere -> a single err message', () => {
    const txns = [txn({ narration: 'POS PURCHASE', debit: 5000, dateISO: '2026-01-05' })];
    const result = computeWorkNameCheck({ label: 'employer', name: 'Acme Corp' }, txns);
    expect(result.found).toBe(false);
    const messages = buildWorkNameCheckMessages(result);
    expect(messages).toHaveLength(1);
    expect(messages[0].status).toBe('err');
    expect(messages[0].message).toContain('Acme Corp');
    expect(messages[0].message).toContain('could not be found');
  });

  test('found only in passing narration text, not as a direct sender -> one neutral ok message', () => {
    // "Acme Corp" appears as a stray mention but doesn't hit the 2-word direct-sender match on its own line.
    const txns = [
      txn({ narration: 'TRF FEE RE ACME CORP INVOICE MENTION', debit: 100, dateISO: '2026-01-05' }),
    ];
    const result = computeWorkNameCheck({ label: 'employer', name: 'Acme Corp' }, txns);
    expect(result.found).toBe(true);
    expect(result.inflowMatches).toHaveLength(0);
    const messages = buildWorkNameCheckMessages(result);
    expect(messages).toHaveLength(1);
    expect(messages[0].status).toBe('ok');
    expect(messages[0].message).toContain("doesn't look like the direct sender");
  });

  test('found with 6+ months of salary-labeled inflows -> three ok messages', () => {
    const txns = [
      txn({ narration: 'NIP TRF/ACME CORP/JANUARY SALARY/REF001', credit: 300000, dateISO: '2026-01-25' }),
      txn({ narration: 'NIP TRF/ACME CORP/FEBRUARY SALARY/REF002', credit: 300000, dateISO: '2026-02-25' }),
      txn({ narration: 'NIP TRF/ACME CORP/MARCH SALARY/REF003', credit: 300000, dateISO: '2026-03-25' }),
      txn({ narration: 'NIP TRF/ACME CORP/APRIL SALARY/REF004', credit: 300000, dateISO: '2026-04-25' }),
      txn({ narration: 'NIP TRF/ACME CORP/MAY SALARY/REF005', credit: 300000, dateISO: '2026-05-25' }),
      txn({ narration: 'NIP TRF/ACME CORP/JUNE SALARY/REF006', credit: 300000, dateISO: '2026-06-25' }),
    ];
    const result = computeWorkNameCheck({ label: 'employer', name: 'Acme Corp' }, txns);
    expect(result.found).toBe(true);
    expect(result.inflowMatches).toHaveLength(6);
    expect(result.inflowTotal).toBe(1800000);
    expect(result.salaryLabeledCount).toBe(6);
    expect(result.distinctMonthsCount).toBe(6);
    expect(result.topReason).toBe('Salary');
    expect(result.reasonIsMajority).toBe(true);

    const messages = buildWorkNameCheckMessages(result);
    expect(messages).toHaveLength(3);
    expect(messages[0].status).toBe('ok');
    expect(messages[0].message).toContain('6 inflows');
    expect(messages[0].message).toContain('Most commonly narrated as "Salary"');
    expect(messages[1].status).toBe('ok');
    expect(messages[1].message).toContain('100%');
    expect(messages[2].status).toBe('ok');
    expect(messages[2].message).toContain('6 distinct month(s)');
  });

  test('found but none of the inflows are narrated "Salary" -> warn inconsistent-salary message', () => {
    const txns = [
      txn({ narration: 'NIP TRF/ACME CORP/PAYMENT/REF001', credit: 200000, dateISO: '2026-01-10' }),
      txn({ narration: 'NIP TRF/ACME CORP/PAYMENT/REF002', credit: 200000, dateISO: '2026-02-10' }),
    ];
    const result = computeWorkNameCheck({ label: 'business', name: 'Acme Corp' }, txns);
    const messages = buildWorkNameCheckMessages(result);
    const warnMsg = messages.find((m) => m.message.includes('Inconsistent salary narration'));
    expect(warnMsg).toBeDefined();
    expect(warnMsg!.status).toBe('warn');
  });

  test('found but fewer than 6 distinct months -> warn message on the months check', () => {
    const txns = [
      txn({ narration: 'NIP TRF/ACME CORP/JANUARY SALARY/REF001', credit: 300000, dateISO: '2026-01-25' }),
      txn({ narration: 'NIP TRF/ACME CORP/FEBRUARY SALARY/REF002', credit: 300000, dateISO: '2026-02-25' }),
    ];
    const result = computeWorkNameCheck({ label: 'employer', name: 'Acme Corp' }, txns);
    const messages = buildWorkNameCheckMessages(result);
    const monthsMsg = messages.find((m) => m.message.includes('distinct month(s) so far'));
    expect(monthsMsg).toBeDefined();
    expect(monthsMsg!.status).toBe('warn');
    expect(monthsMsg!.message).toContain('2 distinct month(s)');
  });

  test('an alt name ("also known as") is folded into the same word-matching pass', () => {
    const txns = [
      txn({ narration: 'NIP TRF/GRACE CYC/FEBRUARY SALARY/REF001', credit: 150000, dateISO: '2026-02-14' }),
    ];
    // Full name never appears verbatim - only the shortened "also known as" form does.
    const result = computeWorkNameCheck(
      { label: 'employer', name: 'Grace Covenant Youth Church', altName: 'Grace CYC' },
      txns
    );
    expect(result.inflowMatches).toHaveLength(1);
    // The applicant's own typed name is still what's shown, not the alt name.
    const messages = buildWorkNameCheckMessages(result);
    expect(messages[0].message).toContain('Grace Covenant Youth Church');
  });

  test('single-word names only need every one of their (one) word to hit', () => {
    const txns = [txn({ narration: 'NIP TRF/GTB SALARY/REF001', credit: 100000, dateISO: '2026-01-10' })];
    const result = computeWorkNameCheck({ label: 'employer', name: 'GTB' }, txns);
    expect(result.inflowMatches).toHaveLength(1);
  });
});
