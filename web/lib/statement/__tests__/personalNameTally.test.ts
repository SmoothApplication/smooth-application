// Ported scenarios from index.html's account-holder-name-vs-applicant-name check
// (~line 14811-14842), including the declared-spouse-sponsor exception.
import { buildPersonalNameTallyMessage } from '../personalNameTally';

const NOT_MARRIED = { married: false, spouseSponsoring: false, spouseName: '' };

describe('buildPersonalNameTallyMessage', () => {
  test('null when no name has been entered', () => {
    expect(buildPersonalNameTallyMessage('', 'Chidinma Okafor', NOT_MARRIED)).toBeNull();
    expect(buildPersonalNameTallyMessage('   ', 'Chidinma Okafor', NOT_MARRIED)).toBeNull();
  });

  test('null when no account holder name was detected on the statement', () => {
    expect(buildPersonalNameTallyMessage('Chidinma Okafor', null, NOT_MARRIED)).toBeNull();
  });

  test('ok when the detected holder name matches the declared name', () => {
    const result = buildPersonalNameTallyMessage('Chidinma Okafor', 'Chidinma Okafor', NOT_MARRIED);
    expect(result).not.toBeNull();
    expect(result!.status).toBe('ok');
    expect(result!.message).toContain('matches what you entered');
  });

  test('warn on a mismatch when the applicant is not married / has no declared spouse sponsor', () => {
    const result = buildPersonalNameTallyMessage('Chidinma Okafor', 'Ade Bello', NOT_MARRIED);
    expect(result).not.toBeNull();
    expect(result!.status).toBe('warn');
    expect(result!.message).toContain('Ade Bello');
    expect(result!.message).toContain('sponsor documentation');
  });

  test('warn on a mismatch when married but no spouse declared as sponsor', () => {
    const result = buildPersonalNameTallyMessage('Chidinma Okafor', 'Ade Bello', {
      married: true,
      spouseSponsoring: false,
      spouseName: 'Ade Bello',
    });
    expect(result!.status).toBe('warn');
  });

  test('ok (spouse framing) when married, spouse declared as sponsor, and the holder name matches the spouse', () => {
    const result = buildPersonalNameTallyMessage('Chidinma Okafor', 'Ade Bello', {
      married: true,
      spouseSponsoring: true,
      spouseName: 'Ade Bello',
    });
    expect(result).not.toBeNull();
    expect(result!.status).toBe('ok');
    expect(result!.message).toContain('spouse');
    expect(result!.message).toContain('Ade Bello');
    expect(result!.message).toContain('sponsor letter');
  });

  test('warn (not the spouse) when married + spouse-sponsoring declared but the holder name matches neither', () => {
    const result = buildPersonalNameTallyMessage('Chidinma Okafor', 'Someone Else', {
      married: true,
      spouseSponsoring: true,
      spouseName: 'Ade Bello',
    });
    expect(result!.status).toBe('warn');
  });

  test('null (silent) on a partial match, same as the business-statement version', () => {
    // "chidinma" found, "okafor" not found -> 'partial', not 'fail'.
    const result = buildPersonalNameTallyMessage('Chidinma Okafor', 'Chidinma Eze', NOT_MARRIED);
    expect(result).toBeNull();
  });
});
